"""Server-authoritative Oasis Field match engine.

The casino API owns room membership and balances.  This module owns only the
match state and contains no database or web-framework code, which keeps the
rule implementation deterministic and testable.
"""

from __future__ import annotations

from copy import deepcopy
from pathlib import Path
import json
import random
import secrets
from typing import Any


CATALOG_PATH = Path(__file__).with_name("oasisfield_catalog.json")
HAND_LIMIT = 18
STARTING_HAND = 9
END_LIMITS = {50, 75, 100, 125, 150}
DISEASE_CHAIN = ("cold", "fever", "hell", "heaven")
ATTACK_SUPPORT_EFFECTS = {"add_magic_attack", "double_attack", "sure_all_attack"}
REACTIVE_MAGIC_EFFECTS = {"reflect_magic", "wall_defense"}
SPECIAL_EFFECTS = {"sell", "buy", "exchange"}
DEMON_NAMES = ("小悪魔", "中悪魔", "大悪魔", "イタズラマン", "めぐみの妖精")
DEMON_WEIGHTS = (7, 5, 3, 5, 5)
ELEMENT_BLOCKS = {
    "fire": {"water", "light"},
    "water": {"fire", "light"},
    "wood": {"earth", "light"},
    "earth": {"wood", "light"},
}
HAND_ORDER = {
    "exchange": 0,
    "buy": 0,
    "sell": 0,
    "weapon": 1,
    "enchantment": 2,
    "armor": 3,
    "magic": 4,
    "item": 5,
}


class OasisRuleError(ValueError):
    """A user-visible invalid move."""


def _load_catalog() -> list[dict[str, Any]]:
    with CATALOG_PATH.open("r", encoding="utf-8") as source:
        cards = json.load(source)
    if len(cards) != 242:
        raise RuntimeError(f"Oasis Field catalog must contain 242 cards, got {len(cards)}")
    return cards


CATALOG = _load_catalog()
CATALOG_BY_ID = {card["id"]: card for card in CATALOG}
CATALOG_BY_NAME = {card.get("sourceName", card["name"]): card for card in CATALOG}


def _uid() -> str:
    return secrets.token_hex(7)


def _copy_card(master: dict[str, Any]) -> dict[str, Any]:
    card = deepcopy(master)
    card["uid"] = _uid()
    return card


def _player(user_id: str, user_name: str, ready: bool = False) -> dict[str, Any]:
    return {
        "user_id": str(user_id),
        "user_name": user_name,
        "ready": ready,
        "hp": 40,
        "mp": 10,
        "gold": 20,
        "hand": [],
        "learned_magics": [],
        "statuses": [],
        "guardian": None,
        "alive": True,
        "attack_boost": 0,
        "free_magic_uses": 0,
        "result": None,
    }


def new_game(
    room_id: str,
    guild_id: str,
    rate: int,
    host_user_id: str,
    players: list[dict[str, Any]],
    end_time_limit: int = 100,
) -> dict[str, Any]:
    limit = int(end_time_limit)
    if limit not in END_LIMITS:
        raise OasisRuleError("終末の刻は50・75・100・125・150から選んでください")
    return {
        "room_id": room_id,
        "guild_id": str(guild_id),
        "rate": int(rate),
        "host_user_id": str(host_user_id),
        "phase": "waiting",
        "players": [
            _player(
                row["user_id"],
                row["user_name"],
                str(row["user_id"]) == str(host_user_id),
            )
            for row in players
        ],
        "turn_index": 0,
        "turn_count": 0,
        "end_time_limit": limit,
        "endgame": False,
        "pending_attack": None,
        "pending_trade": None,
        "guardian_queue": [],
        "guardian_resume_index": None,
        "ascension_queue": [],
        "ascension_after_resolution": None,
        "battle": None,
        "logs": ["対戦相手の準備を待っています。"],
        "pot": 0,
        "winner_ids": [],
        "settled": False,
    }


def add_lobby_player(game: dict[str, Any], user_id: str, user_name: str) -> None:
    if game["phase"] != "waiting":
        return
    if find_player(game, user_id):
        return
    game["players"].append(_player(user_id, user_name))


def find_player(game: dict[str, Any], user_id: str) -> dict[str, Any] | None:
    target = str(user_id)
    return next((player for player in game["players"] if player["user_id"] == target), None)


def _living(game: dict[str, Any]) -> list[dict[str, Any]]:
    return [player for player in game["players"] if player["alive"] and player["hp"] > 0]


def _actor(game: dict[str, Any]) -> dict[str, Any]:
    return game["players"][game["turn_index"]]


def _card(player: dict[str, Any], uid: str) -> dict[str, Any] | None:
    return next(
        (
            card
            for card in [*player["hand"], *player["learned_magics"]]
            if card["uid"] == uid
        ),
        None,
    )


def _is_learned(player: dict[str, Any], uid: str) -> bool:
    return any(card["uid"] == uid for card in player["learned_magics"])


def _sort_hand(player: dict[str, Any]) -> None:
    def rank(card: dict[str, Any]) -> tuple[Any, ...]:
        effect = card.get("effect", "")
        category = "enchantment" if card.get("catalogGroup") == "additional_weapon" else card["type"]
        return (
            HAND_ORDER.get(effect, HAND_ORDER.get(category, 9)),
            card.get("attack", 0) + card.get("defense", 0),
            card.get("name", ""),
        )

    player["hand"].sort(key=rank)


def _weighted_card(endgame: bool = False) -> dict[str, Any]:
    if endgame and random.random() < 0.25:
        name = random.choices(DEMON_NAMES, weights=DEMON_WEIGHTS, k=1)[0]
        return _copy_card(CATALOG_BY_NAME[name])
    weights = [max(0.0001, float(card.get("drawRate", 0.2))) for card in CATALOG]
    return _copy_card(random.choices(CATALOG, weights=weights, k=1)[0])


def _draw(game: dict[str, Any], player: dict[str, Any], count: int = 1) -> None:
    for _ in range(max(0, int(count))):
        if len(player["hand"]) >= HAND_LIMIT:
            discarded = random.choice(player["hand"])
            player["hand"].remove(discarded)
            game["logs"].insert(0, f'{player["user_name"]}の手札上限により「{discarded["name"]}」を捨てました。')
        player["hand"].append(_weighted_card(game["endgame"]))
    _sort_hand(player)


def _consume(player: dict[str, Any], uid: str) -> tuple[dict[str, Any], bool]:
    for cards, learned in ((player["hand"], False), (player["learned_magics"], True)):
        for index, card in enumerate(cards):
            if card["uid"] != uid:
                continue
            if learned:
                return deepcopy(card), True
            return cards.pop(index), False
    raise OasisRuleError("そのカードは手札にありません")


def _learn(player: dict[str, Any], card: dict[str, Any]) -> None:
    if card["type"] != "magic":
        return
    if not any(known["id"] == card["id"] for known in player["learned_magics"]):
        learned = deepcopy(card)
        learned["uid"] = f'learned-{card["id"]}'
        player["learned_magics"].append(learned)
        if len(player["learned_magics"]) > 6:
            player["learned_magics"].pop(0)


def _transform_dream(card: dict[str, Any], player: dict[str, Any]) -> dict[str, Any]:
    if "dream" not in player["statuses"] or random.random() >= 0.50:
        return card
    candidates = [
        master
        for master in CATALOG
        if master["type"] == card["type"]
        and (
            card.get("catalogGroup") != "additional_weapon"
            or master.get("catalogGroup") == "additional_weapon"
        )
    ]
    if not candidates:
        return card
    transformed = _copy_card(random.choice(candidates))
    transformed["dream_original"] = card["name"]
    transformed["uid"] = card["uid"]
    return transformed


def _damage(game: dict[str, Any], player: dict[str, Any], amount: int) -> int:
    damage = max(0, int(amount))
    before = player["hp"]
    player["hp"] = max(0, player["hp"] - damage)
    actual = before - player["hp"]
    if actual > 0 and player.get("guardian") and random.random() < 0.10:
        name = player["guardian"]["name"]
        player["guardian"] = None
        game["logs"].insert(0, f'{player["user_name"]}の{name}はダメージに驚いて去りました。')
    if player["hp"] == 0:
        charm = next(
            (card for card in player["hand"] if card.get("sourceName", card["name"]) == "太陽のお守り"),
            None,
        )
        if charm:
            player["hand"].remove(charm)
            player["hp"] = 10
            _draw(game, player)
            game["logs"].insert(0, f'{player["user_name"]}の太陽のお守りが発動し、HPが10になりました。')
        else:
            bow = next(
                (
                    card for card in player["hand"]
                    if card.get("sourceName", card["name"]) == "昇天弓"
                ),
                None,
            )
            if bow:
                player["hand"].remove(bow)
                game["ascension_queue"].append({
                    "player_id": player["user_id"],
                    "bow": bow,
                })
                game["logs"].insert(0, f'{player["user_name"]}の昇天弓が発動します。')
    player["alive"] = player["hp"] > 0
    return actual


def _heal(player: dict[str, Any], amount: int) -> int:
    before = player["hp"]
    player["hp"] = min(99, player["hp"] + max(0, int(amount)))
    player["alive"] = player["hp"] > 0
    return player["hp"] - before


def _apply_status(game: dict[str, Any], player: dict[str, Any], status: str) -> None:
    if not status or status in {"none", "all"}:
        return
    incoming = DISEASE_CHAIN.index(status) if status in DISEASE_CHAIN else -1
    current = next((state for state in DISEASE_CHAIN if state in player["statuses"]), None)
    if incoming >= 0 and current:
        index = DISEASE_CHAIN.index(current)
        if index == len(DISEASE_CHAIN) - 1:
            _damage(game, player, player["hp"])
            return
        player["statuses"] = [state for state in player["statuses"] if state not in DISEASE_CHAIN]
        status = DISEASE_CHAIN[index + 1]
    if status not in player["statuses"]:
        player["statuses"].append(status)


def _end_statuses(game: dict[str, Any], player: dict[str, Any]) -> None:
    disease = next((state for state in DISEASE_CHAIN if state in player["statuses"]), None)
    change = {"cold": -1, "fever": -2, "hell": -5, "heaven": 5}.get(disease, 0)
    if change < 0:
        _damage(game, player, -change)
    elif change > 0:
        _heal(player, change)
    if disease and player["alive"] and random.random() < 0.05:
        index = DISEASE_CHAIN.index(disease)
        if index == len(DISEASE_CHAIN) - 1:
            _damage(game, player, player["hp"])
        else:
            player["statuses"].remove(disease)
            player["statuses"].append(DISEASE_CHAIN[index + 1])


def _finish_if_needed(game: dict[str, Any]) -> bool:
    if game.get("ascension_queue"):
        return False
    living = _living(game)
    if len(living) > 1:
        return False
    game["phase"] = "finished"
    game["pending_attack"] = None
    game["pending_trade"] = None
    game["winner_ids"] = [living[0]["user_id"]] if living else []
    for player in game["players"]:
        player["result"] = "win" if player["user_id"] in game["winner_ids"] else "lose"
    game["logs"].insert(
        0,
        f'{living[0]["user_name"]}の勝利です。' if living else "全員が倒れ、引き分けになりました。",
    )
    return True


def _advance_turn_index(game: dict[str, Any]) -> None:
    start = game["turn_index"]
    for step in range(1, len(game["players"]) + 1):
        index = (start + step) % len(game["players"])
        player = game["players"][index]
        if player["alive"] and player["hp"] > 0:
            game["turn_index"] = index
            break
    game["phase"] = "turn"
    game["battle"] = None
    game["guardian_queue"] = []
    game["guardian_resume_index"] = None
    game["logs"].insert(0, f'{_actor(game)["user_name"]}のターンです。')


def _next_turn(game: dict[str, Any]) -> None:
    ending = _actor(game)
    _end_statuses(game, ending)
    if _start_next_ascension(game, "advance_turn"):
        return
    if _finish_if_needed(game):
        return
    game["turn_count"] += 1
    if not game["endgame"] and game["turn_count"] >= game["end_time_limit"]:
        game["endgame"] = True
        game["logs"].insert(0, "終末の刻が始まりました。授かるカードに悪魔が混ざります。")
    guardian_owners = [
        player["user_id"]
        for player in _living(game)
        if player["user_id"] != ending["user_id"]
        and player.get("guardian")
        and random.random() < 0.25
    ]
    if guardian_owners:
        game["guardian_queue"] = guardian_owners
        game["guardian_resume_index"] = game["turn_index"]
        _continue_guardian_cycle(game)
        return
    _advance_turn_index(game)


def set_ready(game: dict[str, Any], user_id: str, ready: bool) -> None:
    if game["phase"] not in {"waiting", "finished"}:
        raise OasisRuleError("対戦中は準備状態を変更できません")
    player = find_player(game, user_id)
    if not player:
        raise OasisRuleError("この部屋の参加者ではありません")
    player["ready"] = bool(ready)


def start_game(game: dict[str, Any], user_id: str) -> None:
    if str(user_id) != game["host_user_id"]:
        raise OasisRuleError("ホストだけが開始できます")
    if not 2 <= len(game["players"]) <= 8:
        raise OasisRuleError("2〜8人で開始してください")
    if not all(player["ready"] for player in game["players"]):
        raise OasisRuleError("全員の準備完了が必要です")
    game["phase"] = "turn"
    game["turn_index"] = random.randrange(len(game["players"]))
    game["turn_count"] = 0
    game["endgame"] = False
    game["pending_attack"] = None
    game["pending_trade"] = None
    game["winner_ids"] = []
    game["settled"] = False
    game["pot"] = int(game["rate"]) * len(game["players"])
    for player in game["players"]:
        reset = _player(player["user_id"], player["user_name"], False)
        player.clear()
        player.update(reset)
        _draw(game, player, STARTING_HAND)
    game["logs"] = [f'{_actor(game)["user_name"]}から対戦を開始します。']


def _support_sequence(
    player: dict[str, Any],
    primary: dict[str, Any],
    support_uids: list[str],
) -> tuple[list[dict[str, Any]], int]:
    supports: list[dict[str, Any]] = []
    previous: dict[str, Any] | None = primary
    primary_all = bool(
        primary.get("isAllAttack")
        or primary.get("target") == "all_enemies"
        or primary.get("effect") == "all_attack"
    )
    for uid in support_uids:
        card = _card(player, uid)
        if not card:
            raise OasisRuleError("補助カードが見つかりません")
        is_enchantment = card.get("catalogGroup") == "additional_weapon"
        is_magic = card["type"] == "magic" and card.get("effect") in ATTACK_SUPPORT_EFFECTS
        is_spirit = card.get("effect") == "mp_free_magic"
        if not (is_enchantment or is_magic or is_spirit):
            raise OasisRuleError("そのカードは攻撃に重ねられません")
        if primary_all:
            raise OasisRuleError("全体武器には他のカードを重ねられません")
        if is_spirit:
            if not previous or previous["type"] != "magic":
                raise OasisRuleError("精霊は直前の奇跡に重ねてください")
        supports.append(card)
        previous = card
    sequence = [primary, *supports]
    mp_cost = sum(
        int(card.get("mpCost", 0))
        for index, card in enumerate(sequence)
        if card["type"] == "magic"
        and not (
            index + 1 < len(sequence)
            and sequence[index + 1].get("effect") == "mp_free_magic"
        )
    )
    if player["mp"] < mp_cost:
        raise OasisRuleError(f"MPが{mp_cost}必要です")
    return supports, mp_cost


def _elements(cards: list[dict[str, Any]]) -> str:
    forced = next(
        (
            card
            for card in reversed(cards)
            if card.get("sourceName", card["name"]) in {"発火のワンド", "魔水のワンド"}
        ),
        None,
    )
    if forced:
        return forced.get("element", "none")
    values = {card.get("element", "none") for card in cards}
    if len(values) == 1:
        return next(iter(values))
    if len(values) == 2 and "light" in values:
        other = next((value for value in values if value != "light"), "none")
        if other in {"fire", "water", "wood", "earth"}:
            return other
    return "none"


def _attack_targets(
    game: dict[str, Any],
    actor: dict[str, Any],
    card: dict[str, Any],
    target_id: str | None,
) -> list[str]:
    living_ids = [player["user_id"] for player in _living(game)]
    all_attack = bool(
        card.get("isAllAttack")
        or card.get("target") == "all_enemies"
        or card.get("effect") in {"all_attack", "magic_all_attack"}
    )
    if all_attack:
        return [user_id for user_id in living_ids if user_id != actor["user_id"]]
    if card.get("effect") == "random_target":
        mortar_owner = next(
            (
                player
                for player in _living(game)
                if any(c.get("sourceName", c["name"]) == "あぶないウス" for c in player["hand"])
            ),
            None,
        )
        return [mortar_owner["user_id"] if mortar_owner else random.choice(living_ids)]
    target = find_player(game, target_id or "")
    if not target or not target["alive"]:
        raise OasisRuleError("生存している対象を選んでください")
    if "fog" in actor["statuses"] and target["user_id"] != actor["user_id"]:
        opponents = [
            player for player in _living(game)
            if player["user_id"] != actor["user_id"]
        ]
        target = random.choice(opponents)
    return [target["user_id"]]


def _hit(card: dict[str, Any], defender: dict[str, Any]) -> bool:
    chance = int(card.get("effectChance", 100))
    all_attack = bool(card.get("isAllAttack") or card.get("target") == "all_enemies")
    if all_attack and "dark_cloud" in defender["statuses"]:
        return True
    return chance >= 100 or random.randrange(100) < chance


def _begin_attack(
    game: dict[str, Any],
    actor: dict[str, Any],
    primary_uid: str,
    support_uids: list[str],
    target_id: str | None,
) -> None:
    primary_card = _card(actor, primary_uid)
    if not primary_card:
        raise OasisRuleError("攻撃カードがありません")
    can_attack = (
        primary_card["type"] == "weapon"
        or primary_card.get("effect") == "attack_defense"
        or (
            primary_card["type"] == "magic"
            and primary_card.get("effect") in {"magic_attack", "magic_all_attack", "hp_drain", "inflict_status"}
        )
    )
    if not can_attack:
        raise OasisRuleError("そのカードでは攻撃できません")
    supports, mp_cost = _support_sequence(actor, primary_card, support_uids)
    primary, primary_learned = _consume(actor, primary_uid)
    primary = primary if primary_learned else _transform_dream(primary, actor)
    consumed_supports: list[dict[str, Any]] = []
    draw_count = 0 if primary_learned else 1
    for uid in support_uids:
        used, learned = _consume(actor, uid)
        used = used if learned else _transform_dream(used, actor)
        consumed_supports.append(used)
        draw_count += 0 if learned else 1
        if used["type"] == "magic":
            _learn(actor, used)
    if primary["type"] == "magic":
        _learn(actor, primary)
    actor["mp"] -= mp_cost

    cards = [primary, *consumed_supports]
    attack = int(primary.get("attack", primary.get("effectPower", 0)))
    attack += sum(
        int(card.get("attack", card.get("effectPower", 0)))
        for card in consumed_supports
        if card.get("catalogGroup") == "additional_weapon" or card.get("effect") == "add_magic_attack"
    )
    multiplier = 2 if any(card.get("effect") == "double_attack" for card in consumed_supports) else 1
    attack = max(0, (attack + int(actor.get("attack_boost", 0))) * multiplier)
    if primary.get("effect") == "mp_scaled_attack":
        attack = actor["mp"]
        actor["mp"] = 0
    actor["attack_boost"] = 0
    sure_all = any(card.get("effect") == "sure_all_attack" for card in consumed_supports)
    targets = _attack_targets(game, actor, primary, target_id)
    if sure_all:
        targets = [player["user_id"] for player in _living(game) if player["user_id"] != actor["user_id"]]
    hit_count = max(1, int(primary.get("hitCount", 1)))
    game["pending_attack"] = {
        "owner_id": actor["user_id"],
        "attacker_id": actor["user_id"],
        "targets": targets,
        "target_index": 0,
        "target_id": targets[0] if targets else None,
        "primary": primary,
        "cards": cards,
        "attack": attack,
        "hit_count": hit_count,
        "element": "none" if sure_all else _elements(cards),
        "is_magic": primary["type"] == "magic",
        "draw_counts": {actor["user_id"]: draw_count},
        "chain": 0,
        "hit": False,
        "after_resolution": "next_turn",
    }
    if not targets:
        _draw(game, actor, draw_count)
        game["pending_attack"] = None
        _next_turn(game)
        return
    _prepare_defense(game)


def _prepare_defense(game: dict[str, Any]) -> None:
    pending = game["pending_attack"]
    defender = find_player(game, pending["target_id"])
    if not defender or not defender["alive"]:
        _advance_attack_queue(game)
        return
    pending["hit"] = _hit(pending["primary"], defender)
    game["phase"] = "defense"
    game["battle"] = {
        "attacker_id": pending["attacker_id"],
        "defender_id": defender["user_id"],
        "attack_cards": pending["cards"],
        "defense_cards": [],
        "attack": pending["attack"],
        "defense": 0,
        "damage": None,
        "element": pending["element"],
        "hit": pending["hit"],
    }
    if defender["user_id"] == pending["attacker_id"]:
        _defend(game, defender, [])
        return
    if not pending["hit"]:
        game["logs"].insert(0, f'{pending["primary"]["name"]}は{defender["user_name"]}に外れました。')


def _can_block(card: dict[str, Any], pending: dict[str, Any], flash: bool) -> bool:
    element = pending.get("element", "none")
    effect = card.get("effect")
    secondary = card.get("secondaryEffect")
    if effect == "wall_defense":
        return not pending["is_magic"] and element == "none"
    if pending["is_magic"] and (effect in {"reflect_magic", "nullify_magic"} or secondary in {"reflect_magic", "nullify_magic"}):
        return True
    if effect == "reflect_normal":
        return not pending["is_magic"] and element == "none"
    if effect == "element_change":
        return element != "none"
    if element in {"none", "dark"}:
        return True
    if element == "light" or flash:
        return False
    return card.get("element", "none") in ELEMENT_BLOCKS.get(element, set())


def _defend(game: dict[str, Any], player: dict[str, Any], defense_uids: list[str]) -> None:
    pending = game["pending_attack"]
    if game["phase"] != "defense" or pending["target_id"] != player["user_id"]:
        raise OasisRuleError("現在はあなたの防御ではありません")
    if "flash" in player["statuses"] and len(defense_uids) > 1:
        raise OasisRuleError("閃光状態では防御カードを1枚しか使えません")
    cards: list[dict[str, Any]] = []
    for uid in defense_uids:
        card = _card(player, uid)
        if not card:
            raise OasisRuleError("防御カードが見つかりません")
        spirit_for_previous_magic = (
            card.get("effect") == "mp_free_magic"
            and bool(cards)
            and cards[-1]["type"] == "magic"
        )
        if not spirit_for_previous_magic and not _can_block(card, pending, "flash" in player["statuses"]):
            raise OasisRuleError(f'「{card["name"]}」ではこの攻撃を防げません')
        cards.append(card)
    for index, card in enumerate(cards):
        if card.get("effect") == "mp_free_magic":
            if index == 0 or cards[index - 1]["type"] != "magic":
                raise OasisRuleError("精霊は直前の奇跡に重ねてください")
    mp_cost = sum(
        int(card.get("mpCost", 0))
        for index, card in enumerate(cards)
        if card["type"] == "magic"
        and not (
            index + 1 < len(cards)
            and cards[index + 1].get("effect") == "mp_free_magic"
        )
    )
    if player["mp"] < mp_cost:
        raise OasisRuleError(f"MPが{mp_cost}必要です")
    player["mp"] -= mp_cost

    used_cards: list[dict[str, Any]] = []
    draw_count = 0
    for card in cards:
        used, learned = _consume(player, card["uid"])
        used = used if learned else _transform_dream(used, player)
        used_cards.append(used)
        draw_count += 0 if learned else 1
        if used["type"] == "magic":
            _learn(player, used)
    pending["draw_counts"][player["user_id"]] = pending["draw_counts"].get(player["user_id"], 0) + draw_count

    usable = [card for card in used_cards if _can_block(card, pending, "flash" in player["statuses"])]
    reflector = next(
        (
            card
            for card in usable
            if card.get("effect") == "reflect_normal"
            or (pending["is_magic"] and card.get("effect") == "reflect_magic")
            or (pending["is_magic"] and card.get("secondaryEffect") == "reflect_magic")
        ),
        None,
    )
    nullifier = next(
        (
            card
            for card in usable
            if card.get("effect") in {"nullify_magic", "wall_defense"}
            or card.get("secondaryEffect") == "nullify_magic"
        ),
        None,
    )
    defense_total = sum(int(card.get("defense", 0)) for card in usable)
    damage = 0
    if pending["hit"] and not reflector and not nullifier:
        damage = max(0, pending["attack"] - defense_total) * pending["hit_count"]
    actual = _damage(game, player, damage)
    primary = pending["primary"]
    if pending["hit"] and actual > 0:
        if primary.get("effect") == "instant_defeat" or pending["element"] == "dark":
            _damage(game, player, player["hp"])
        owner = find_player(game, pending["owner_id"])
        if primary.get("effect") == "hp_drain" and owner:
            _heal(owner, actual)
    status = primary.get("statusEffect", "none")
    status_landed = (
        pending["hit"]
        and not reflector
        and not nullifier
        and (int(pending["attack"]) == 0 or actual > 0)
    )
    if status != "none" and status_landed:
        _apply_status(game, player, status)
    for card in usable:
        effect = card.get("effect")
        chance = int(card.get("effectChance", 100))
        if random.randrange(100) >= chance:
            continue
        attacker = find_player(game, pending["attacker_id"])
        if effect == "inflict_status" and (card.get("target") == "self" or actual > 0):
            _apply_status(game, player if card.get("target") == "self" else attacker, card.get("statusEffect"))
        elif actual > 0 and effect == "counter_attack" and attacker:
            _damage(game, attacker, actual * max(1, int(card.get("effectPower", 1))))
        elif actual > 0 and effect == "mp_gain_on_damage":
            player["mp"] = min(99, player["mp"] + actual * max(1, int(card.get("effectPower", 2))))
        elif actual > 0 and effect == "steal_gold_on_damage" and attacker:
            stolen = min(attacker["gold"], actual)
            attacker["gold"] -= stolen
            player["gold"] = min(99, player["gold"] + stolen)

    game["battle"].update(
        {
            "defense_cards": usable,
            "defense": defense_total,
            "damage": actual,
            "blocked": pending["hit"] and actual == 0,
        }
    )
    if reflector:
        mode = reflector.get("reflectionMode", "reflect")
        living_ids = [candidate["user_id"] for candidate in _living(game)]
        target_id = pending["attacker_id"] if mode != "bounce" else random.choice(living_ids)
        pending["chain"] += 1
        if pending["chain"] > 40:
            raise OasisRuleError("反射連鎖が長すぎるため攻撃を終了しました")
        pending["attacker_id"] = player["user_id"]
        pending["target_id"] = target_id
        game["logs"].insert(0, f'{player["user_name"]}が攻撃を{"弾き" if mode == "bounce" else "反射し"}ました。')
        if target_id == player["user_id"]:
            _defend(game, player, [])
        else:
            _prepare_defense(game)
        return
    _advance_attack_queue(game)


def _advance_attack_queue(game: dict[str, Any]) -> None:
    pending = game["pending_attack"]
    pending["target_index"] += 1
    if pending["target_index"] < len(pending["targets"]):
        pending["attacker_id"] = pending["owner_id"]
        pending["target_id"] = pending["targets"][pending["target_index"]]
        _prepare_defense(game)
        return
    for user_id, count in pending["draw_counts"].items():
        player = find_player(game, user_id)
        if player:
            _draw(game, player, count)
    game["pending_attack"] = None
    _dispatch_after_resolution(game, pending.get("after_resolution", "next_turn"))


def _finish_utility(
    game: dict[str, Any],
    actor: dict[str, Any],
    consumed: list[tuple[dict[str, Any], bool]],
    message: str,
) -> None:
    for card, learned in consumed:
        if card["type"] == "magic":
            _learn(actor, card)
        if not learned:
            _draw(game, actor)
    game["logs"].insert(0, message)
    if game.get("pending_attack"):
        return
    _dispatch_after_resolution(game, "next_turn")


def _use_utility(
    game: dict[str, Any],
    actor: dict[str, Any],
    card_uid: str,
    target_id: str | None,
    support_uids: list[str],
) -> None:
    original = _card(actor, card_uid)
    if not original:
        raise OasisRuleError("そのカードはありません")
    if original.get("effect") in SPECIAL_EFFECTS:
        game["pending_trade"] = {"card_uid": card_uid, "effect": original["effect"]}
        game["phase"] = f'trade_{original["effect"]}'
        return
    if original.get("effect") in ATTACK_SUPPORT_EFFECTS | REACTIVE_MAGIC_EFFECTS:
        raise OasisRuleError("この奇跡は攻撃または防御と同時に使用してください")
    target = find_player(game, target_id or actor["user_id"])
    if original.get("target") == "self":
        target = actor
    if not target or not target["alive"]:
        raise OasisRuleError("対象を選んでください")
    if "fog" in actor["statuses"] and target is not actor:
        opponents = [
            player for player in _living(game)
            if player["user_id"] != actor["user_id"]
        ]
        target = random.choice(opponents)

    support_cards, support_cost = _support_sequence(actor, original, support_uids)
    if support_cards and original["type"] != "magic":
        raise OasisRuleError("精霊は奇跡にだけ重ねられます")
    if actor["mp"] < support_cost:
        raise OasisRuleError(f"MPが{support_cost}必要です")
    actor["mp"] -= support_cost
    consumed: list[tuple[dict[str, Any], bool]] = []
    used, learned = _consume(actor, card_uid)
    used = used if learned else _transform_dream(used, actor)
    consumed.append((used, learned))
    for uid in support_uids:
        support, was_learned = _consume(actor, uid)
        support = support if was_learned else _transform_dream(support, actor)
        consumed.append((support, was_learned))

    effect = used.get("effect")
    amount = int(used.get("effectPower", used.get("heal", used.get("attack", 0))))
    message = f'{actor["user_name"]}が「{used["name"]}」を使用しました。'
    if effect in {"heal", "heal_hp"}:
        _heal(target, amount)
    elif effect == "heal_mp":
        target["mp"] = min(99, target["mp"] + amount)
    elif effect == "gold_gain":
        target["gold"] = min(99, target["gold"] + amount)
    elif effect == "boost_attack":
        target["attack_boost"] += amount
    elif effect == "cure_status":
        cures = used.get("cureStatuses") or [used.get("statusEffect")]
        target["statuses"] = [] if used.get("statusEffect") == "all" else [
            state for state in target["statuses"] if state not in cures
        ]
    elif effect == "inflict_status":
        _apply_status(game, target, used.get("statusEffect"))
    elif effect == "random_heal_damage":
        _heal(target, amount) if random.random() < 0.5 else _damage(game, target, amount)
    elif effect == "summon_guardian":
        target["guardian"] = _random_guardian(game, target.get("guardian", {}).get("name") if target.get("guardian") else None)
    elif effect == "discard":
        count = min(len(target["hand"]), max(1, amount))
        random.shuffle(target["hand"])
        del target["hand"][:count]
    elif effect == "forget_magic":
        count = min(len(target["learned_magics"]), max(1, amount))
        random.shuffle(target["learned_magics"])
        del target["learned_magics"][:count]
    elif effect == "random_event":
        _supernatural(game, actor, after_resolution="next_turn")
    elif effect == "self_damage":
        _damage(game, actor, amount)
    elif effect == "custom" and used.get("sourceName", used["name"]) == "あぶないウス":
        if not learned:
            actor["hand"].append(used)
            consumed[0] = (used, True)
            _sort_hand(actor)
        _damage(game, actor, 1)
    elif effect == "revive":
        raise OasisRuleError("太陽のお守りはHPが0になった時に自動発動します")
    _finish_utility(game, actor, consumed, message)


GUARDIANS = [
    {"name": "火星神", "element": "fire"},
    {"name": "水星神", "element": "water"},
    {"name": "木星神", "element": "wood"},
    {"name": "土星神", "element": "earth"},
    {"name": "天王神", "element": "light"},
    {"name": "冥王神", "element": "dark"},
    {"name": "海王神", "element": "water"},
    {"name": "金星神", "element": "light"},
    {"name": "地球神", "element": "earth"},
    {"name": "月神", "element": "light"},
]


def _random_guardian(
    game: dict[str, Any],
    current_name: str | None = None,
) -> dict[str, str] | None:
    occupied = {
        player["guardian"]["name"]
        for player in game["players"]
        if player.get("guardian")
    }
    choices = [
        guardian
        for guardian in GUARDIANS
        if guardian["name"] not in occupied and guardian["name"] != current_name
    ]
    return deepcopy(random.choice(choices)) if choices else None


def _guardian_begin_attack(
    game: dict[str, Any],
    owner: dict[str, Any],
    action: dict[str, Any],
    target_ids: list[str],
    *,
    is_magic: bool = False,
    after_resolution: str = "guardian_next",
) -> None:
    guardian = owner.get("guardian") or {
        "name": action.get("source", "超常現象"),
        "element": action.get("element", "none"),
    }
    card = {
        "id": f'guardian-{guardian["name"]}-{action["name"]}',
        "uid": _uid(),
        "name": f'{guardian["name"]}・{action["name"]}',
        "sourceName": action["name"],
        "type": "magic" if is_magic else "weapon",
        "image": "",
        "attack": int(action.get("attack", 0)),
        "defense": 0,
        "effect": action.get("effect", "guardian_attack"),
        "secondaryEffect": "none",
        "effectPower": int(action.get("attack", 0)),
        "effectChance": int(action.get("chance", 100)),
        "hitCount": 1,
        "isAllAttack": len(target_ids) > 1,
        "target": "all_enemies" if len(target_ids) > 1 else "enemy",
        "statusEffect": action.get("status", "none"),
        "element": action.get("element", guardian.get("element", "none")),
        "desc": action["name"],
    }
    game["pending_attack"] = {
        "owner_id": owner["user_id"],
        "attacker_id": owner["user_id"],
        "targets": target_ids,
        "target_index": 0,
        "target_id": target_ids[0],
        "primary": card,
        "cards": [card],
        "attack": int(action.get("attack", 0)),
        "hit_count": 1,
        "element": card["element"],
        "is_magic": is_magic,
        "draw_counts": {},
        "chain": 0,
        "hit": False,
        "after_resolution": after_resolution,
    }
    game["logs"].insert(0, f'{guardian["name"]}が「{action["name"]}」を起こしました。')
    _prepare_defense(game)


def _start_next_ascension(
    game: dict[str, Any],
    after_resolution: str | None = None,
) -> bool:
    if not game.get("ascension_queue"):
        return False
    if after_resolution and not game.get("ascension_after_resolution"):
        game["ascension_after_resolution"] = after_resolution
    while game.get("ascension_queue"):
        entry = game["ascension_queue"].pop(0)
        owner = find_player(game, entry["player_id"])
        targets = [
            player["user_id"]
            for player in _living(game)
            if not owner or player["user_id"] != owner["user_id"]
        ]
        if not owner or not targets:
            continue
        _guardian_begin_attack(
            game,
            owner,
            {
                "name": "昇天弓",
                "source": "昇天弓",
                "attack": 30,
                "chance": 75,
                "element": "light",
            },
            targets,
            after_resolution="ascension_next",
        )
        return True
    return False


def _dispatch_after_resolution(game: dict[str, Any], after_resolution: str) -> None:
    if after_resolution == "ascension_next":
        if _start_next_ascension(game):
            return
        after_resolution = game.get("ascension_after_resolution") or "next_turn"
        game["ascension_after_resolution"] = None
    elif _start_next_ascension(game, after_resolution):
        return
    if _finish_if_needed(game):
        return
    if after_resolution == "guardian_next":
        _continue_guardian_cycle(game)
    elif after_resolution == "advance_turn":
        _advance_turn_index(game)
    else:
        _next_turn(game)


def _guardian_world_artifact(
    game: dict[str, Any],
    owner: dict[str, Any],
    enemies: list[dict[str, Any]],
) -> bool:
    card = _weighted_card(game["endgame"])
    if card["type"] == "weapon" and card.get("catalogGroup") != "additional_weapon":
        targets = [
            enemy["user_id"] for enemy in enemies
        ] if card.get("isAllAttack") else [random.choice(enemies)["user_id"]]
        _guardian_begin_attack(
            game,
            owner,
            {
                "name": card["name"],
                "attack": card.get("attack", 0),
                "chance": card.get("effectChance", 100),
                "element": card.get("element", "none"),
                "effect": card.get("effect", "guardian_attack"),
                "status": card.get("statusEffect", "none"),
            },
            targets,
        )
        return True
    if card["type"] in {"armor", "magic"} or card.get("catalogGroup") == "additional_weapon":
        owner["hand"].append(card)
        _sort_hand(owner)
        game["logs"].insert(0, f'地球神が「{card["name"]}」を{owner["user_name"]}の手札へ加えました。')
        return False
    effect = card.get("effect")
    amount = int(card.get("effectPower", card.get("heal", 0)))
    target = random.choice(enemies)
    if effect == "exchange":
        total = owner["hp"] + owner["mp"] + owner["gold"]
        hp = random.randint(max(0, total - 198), min(99, total))
        remaining = total - hp
        mp = random.randint(max(0, remaining - 99), min(99, remaining))
        owner["hp"], owner["mp"], owner["gold"] = hp, mp, remaining - mp
    elif effect == "sell" and owner["hand"]:
        sale = random.choice(owner["hand"])
        owner["hand"].remove(sale)
        price = int(sale.get("price", 0))
        remaining = price
        for resource in ("gold", "mp", "hp"):
            paid = min(target[resource], remaining)
            target[resource] -= paid
            remaining -= paid
        owner["gold"] = min(99, owner["gold"] + price)
        target["hand"].append(sale)
        _sort_hand(target)
    elif effect == "buy":
        # The original gives the owner the final decision.  The server exposes
        # ordinary "buy" decisions to humans; guardian AI buys only when affordable.
        offer = random.choice(target["hand"]) if target["hand"] else None
        if offer and owner["gold"] >= int(offer.get("price", 0)):
            price = int(offer.get("price", 0))
            owner["gold"] -= price
            target["gold"] = min(99, target["gold"] + price)
            target["hand"].remove(offer)
            owner["hand"].append(offer)
            _sort_hand(owner)
    elif effect in {"heal", "heal_hp"}:
        _heal(owner, amount)
    elif effect == "heal_mp":
        owner["mp"] = min(99, owner["mp"] + amount)
    elif effect == "cure_status":
        owner["statuses"] = []
    elif effect == "boost_attack":
        owner["attack_boost"] += amount
    elif effect == "discard":
        for _ in range(min(len(target["hand"]), max(1, amount))):
            target["hand"].pop(random.randrange(len(target["hand"])))
    elif effect == "forget_magic":
        for _ in range(min(len(target["learned_magics"]), max(1, amount))):
            target["learned_magics"].pop(random.randrange(len(target["learned_magics"])))
    elif effect == "summon_guardian":
        current = owner.get("guardian", {}).get("name")
        owner["guardian"] = _random_guardian(game, current)
    elif effect == "random_event":
        if _supernatural(game, owner, after_resolution="guardian_next"):
            return True
    elif effect == "random_heal_damage":
        _heal(owner, amount) if random.random() < 0.5 else _damage(game, owner, amount)
    elif effect == "self_damage":
        _damage(game, owner, amount)
    else:
        owner["hand"].append(card)
        _sort_hand(owner)
    game["logs"].insert(0, f'地球神が「{card["name"]}」を使いました。')
    return False


def _continue_guardian_cycle(game: dict[str, Any]) -> None:
    if _start_next_ascension(game, "guardian_next"):
        return
    if _finish_if_needed(game):
        return
    while game.get("guardian_queue"):
        owner_id = game["guardian_queue"].pop(0)
        owner = find_player(game, owner_id)
        if not owner or not owner["alive"] or not owner.get("guardian"):
            continue
        enemies = [
            player
            for player in _living(game)
            if player["user_id"] != owner["user_id"]
        ]
        if not enemies:
            break
        guardian = owner["guardian"]
        name = guardian["name"]
        weights = (30, 25, 20, 15, 10)
        choice = random.choices(range(5), weights=weights, k=1)[0]
        all_enemy_ids = [player["user_id"] for player in enemies]
        one_enemy_id = random.choice(all_enemy_ids)
        attack: dict[str, Any] | None = None
        targets = [one_enemy_id]
        if name == "火星神":
            attacks = [
                ("炎のささやき", 3), ("炎のつぶやき", 4), ("炎のしゃべり", 5),
                ("炎のうなり", 6), ("炎の叫び", 7),
            ]
            label, power = attacks[choice]
            attack = {"name": label, "attack": power, "chance": 75, "element": "fire"}
            targets = all_enemy_ids
        elif name == "水星神":
            attacks = [
                {"name": "霧雨", "attack": 1, "chance": 50, "status": "fog"},
                {"name": "かすむ息", "attack": 2, "status": "fog"},
                {"name": "しぶき", "attack": 3, "chance": 50},
                {"name": "泡", "attack": 3},
                {"name": "あられ", "attack": 6, "chance": 50},
            ]
            attack = {**attacks[choice], "element": "water"}
            targets = all_enemy_ids
        elif name == "木星神":
            attacks = [
                {"name": "枝", "attack": 1},
                {"name": "根っこ", "attack": 2},
                {"name": "触手", "attack": 1, "chance": 75, "effect": "hp_drain"},
                {"name": "紅葉", "attack": 0, "status": "dream", "effect": "inflict_status"},
                {"name": "落ち葉の舞", "attack": 2, "chance": 75, "status": "dream"},
            ]
            attack = {**attacks[choice], "element": "wood"}
        elif name == "土星神":
            attacks = [
                ("小石", 2), ("石", 4), ("大きな石", 6), ("体当たり", 9), ("ダイヤモンドアクス", 15),
            ]
            label, power = attacks[choice]
            attack = {"name": label, "attack": power, "element": "earth"}
        elif name == "天王神":
            attacks = [
                {"name": "点滅", "attack": 2},
                {"name": "電撃", "attack": 4, "chance": 25},
                {"name": "後光", "attack": 0, "status": "flash", "effect": "inflict_status"},
                {"name": "祝福", "attack": 5, "effect": "hp_drain"},
                {"name": "レーザービーム", "attack": 10, "chance": 75},
            ]
            attack = {**attacks[choice], "element": "light"}
        elif name == "冥王神":
            attacks = [
                {"name": "思考", "attack": 1, "chance": 25},
                {"name": "まばたき", "attack": 2},
                {"name": "不吉な予感", "attack": 0, "status": "dark_cloud", "effect": "inflict_status"},
                {"name": "咳払い", "attack": 4},
                {"name": "挙手", "attack": 8},
            ]
            attack = {**attacks[choice], "element": "dark"}
        elif name == "海王神":
            if choice == 0:
                owner["statuses"] = []
            elif choice in {1, 3}:
                _heal(owner, 5 if choice == 1 else 10)
            else:
                owner["mp"] = min(99, owner["mp"] + (5 if choice == 2 else 10))
            game["logs"].insert(0, f'{name}が{owner["user_name"]}を助けました。')
        elif name == "金星神":
            if choice == 0:
                for player in _living(game):
                    player["gold"] = min(99, player["gold"] + 1)
            elif choice == 1:
                target = random.choice(enemies)
                target["gold"] = min(99, target["gold"] + 5)
            elif choice == 2:
                target = random.choice(enemies)
                stolen = min(3, target["gold"])
                target["gold"] -= stolen
                owner["gold"] = min(99, owner["gold"] + stolen)
            else:
                owner["gold"] = min(99, owner["gold"] + (8 if choice == 3 else 20))
            game["logs"].insert(0, f'{name}がお金を動かしました。')
        elif name == "地球神":
            if _guardian_world_artifact(game, owner, enemies):
                return
        elif name == "月神":
            candidates = [
                card
                for card in CATALOG
                if card["type"] == "magic" and card.get("effect") not in REACTIVE_MAGIC_EFFECTS
            ]
            magic = random.choice(candidates)
            effect = magic.get("effect")
            if effect in {"magic_attack", "magic_all_attack", "hp_drain", "inflict_status"}:
                targets = all_enemy_ids if magic.get("target") == "all_enemies" else [one_enemy_id]
                _guardian_begin_attack(
                    game,
                    owner,
                    {
                        "name": magic["name"],
                        "attack": magic.get("attack", magic.get("effectPower", 0)),
                        "chance": magic.get("effectChance", 100),
                        "element": magic.get("element", "none"),
                        "effect": effect,
                        "status": magic.get("statusEffect", "none"),
                    },
                    targets,
                    is_magic=True,
                )
                return
            if effect == "cure_status":
                owner["statuses"] = []
            elif effect == "heal_hp":
                _heal(owner, int(magic.get("effectPower", 0)))
            elif effect == "gold_gain":
                owner["gold"] = min(99, owner["gold"] + int(magic.get("effectPower", 0)))
            elif effect == "summon_guardian":
                owner["guardian"] = _random_guardian(game, name)
            elif effect in {"double_attack", "sure_all_attack", "add_magic_attack"}:
                _guardian_begin_attack(
                    game,
                    owner,
                    {"name": f'{magic["name"]}＋満月刀', "attack": 20 if effect == "double_attack" else 10, "element": "none"},
                    all_enemy_ids if effect == "sure_all_attack" else [one_enemy_id],
                )
                return
            game["logs"].insert(0, f'月神が「{magic["name"]}」を起こしました。')
        if attack:
            _guardian_begin_attack(game, owner, attack, targets)
            return
        if _start_next_ascension(game, "guardian_next"):
            return
        if _finish_if_needed(game):
            return
    _advance_turn_index(game)


def _supernatural(
    game: dict[str, Any],
    actor: dict[str, Any],
    *,
    after_resolution: str = "next_turn",
) -> bool:
    living = _living(game)
    event = random.randrange(10)
    if event == 0:
        for player in living:
            player["statuses"] = [state for state in player["statuses"] if state not in DISEASE_CHAIN]
            player["statuses"].append("fever")
        text = "夕焼け：全員が熱病になりました。"
    elif event == 1:
        for player in living:
            _apply_status(game, player, "fog")
        text = "濃霧：全員が霧に包まれました。"
    elif event == 2:
        for player in living:
            player["hp"] = min(player["hp"], 1)
        text = "竜巻：全員のHPが1になりました。"
    elif event == 3:
        target = random.choice(living)
        text = f'巨大なタライ：{target["user_name"]}に50ダメージ。'
        game["logs"].insert(0, text)
        _guardian_begin_attack(
            game,
            actor,
            {"name": "巨大なタライ", "source": "超常現象", "attack": 50, "element": "light"},
            [target["user_id"]],
            after_resolution=after_resolution,
        )
        return True
    elif event == 4:
        targets = [player["user_id"] for player in living if player["user_id"] != actor["user_id"]]
        text = "ブラックホール：相手全員へ闇属性75%攻30。"
        game["logs"].insert(0, text)
        _guardian_begin_attack(
            game,
            actor,
            {"name": "ブラックホール", "source": "超常現象", "attack": 30, "chance": 75, "element": "dark"},
            targets,
            after_resolution=after_resolution,
        )
        return True
    elif event == 5:
        _heal(actor, 50)
        text = f'温泉：{actor["user_name"]}が50回復しました。'
    elif event == 6:
        receiver = random.choice(living)
        total = sum(player["gold"] for player in living)
        for player in living:
            player["gold"] = 0
        receiver["gold"] = min(99, total)
        text = f'金山：ゴールドが{receiver["user_name"]}に集まりました。'
    elif event == 7:
        all_cards = []
        counts = []
        for player in living:
            cards = [*player["hand"], *player["learned_magics"]]
            all_cards.extend(cards)
            counts.append(len(cards))
            player["hand"] = []
            player["learned_magics"] = []
        random.shuffle(all_cards)
        for player, count in zip(living, counts):
            player["hand"] = all_cards[:count]
            del all_cards[:count]
            _sort_hand(player)
        text = "磁気嵐：全員のカードが無作為に入れ替わりました。"
    elif event == 8:
        for player in living:
            player["guardian"] = None
        available = random.sample(GUARDIANS, k=min(len(living), len(GUARDIANS)))
        for player, guardian in zip(living, available):
            player["guardian"] = deepcopy(guardian)
        text = "日食：全員に守護神が宿りました。"
    else:
        for player in living:
            for _ in range(3):
                choices = [card for card in player["hand"] if card.get("effect") not in {"revive"}]
                if not choices:
                    break
                card = random.choice(choices)
                if card in player["hand"]:
                    player["hand"].remove(card)
                    _draw(game, player)
        text = "キノコ大発生：全員が3回ずつ勝手に行動しました。"
    game["logs"].insert(0, text)
    return False


def _trade(
    game: dict[str, Any],
    actor: dict[str, Any],
    payload: dict[str, Any],
) -> None:
    pending = game.get("pending_trade")
    if not pending:
        raise OasisRuleError("取引は開始されていません")
    effect = pending["effect"]
    if payload.get("cancel"):
        game["pending_trade"] = None
        game["phase"] = "turn"
        return
    trade_card, trade_learned = _consume(actor, pending["card_uid"])
    if trade_learned:
        raise OasisRuleError("取引カードの状態が不正です")
    if effect == "exchange":
        values = [int(payload.get(key, -1)) for key in ("hp", "mp", "gold")]
        total = actor["hp"] + actor["mp"] + actor["gold"]
        if any(value < 0 or value > 99 for value in values) or sum(values) != total:
            actor["hand"].append(trade_card)
            _sort_hand(actor)
            raise OasisRuleError(f"HP・MP・￥の合計を{total}にしてください")
        actor["hp"], actor["mp"], actor["gold"] = values
        _finish_utility(game, actor, [(trade_card, False)], f'{actor["user_name"]}が両替しました。')
        return
    other = find_player(game, payload.get("target_id", ""))
    if not other or other is actor or not other["alive"]:
        actor["hand"].append(trade_card)
        _sort_hand(actor)
        raise OasisRuleError("取引相手を選んでください")
    if effect == "sell":
        sale = _card(actor, payload.get("card_uid", ""))
        if not sale or _is_learned(actor, sale["uid"]) or sale["uid"] == trade_card["uid"]:
            actor["hand"].append(trade_card)
            _sort_hand(actor)
            raise OasisRuleError("売る手札を選んでください")
        actor["hand"].remove(sale)
        price = max(0, int(sale.get("price", 0)))
        remaining = price
        for resource in ("gold", "mp", "hp"):
            paid = min(other[resource], remaining)
            other[resource] -= paid
            remaining -= paid
        actor["gold"] = min(99, actor["gold"] + price)
        other["hand"].append(sale)
        _sort_hand(other)
        _finish_utility(
            game,
            actor,
            [(trade_card, False)],
            f'{actor["user_name"]}が{other["user_name"]}へ「{sale["name"]}」を￥{price}で売りました。',
        )
        return
    candidates = list(other["hand"])
    if not candidates:
        _finish_utility(game, actor, [(trade_card, False)], "購入できるカードがありませんでした。")
        return
    offer = random.choice(candidates)
    if not payload.get("confirm"):
        actor["hand"].append(trade_card)
        _sort_hand(actor)
        game["pending_trade"]["offer_uid"] = offer["uid"]
        game["pending_trade"]["target_id"] = other["user_id"]
        game["pending_trade"]["offer"] = offer
        game["phase"] = "trade_buy_confirm"
        return
    offer = _card(other, pending.get("offer_uid", ""))
    if not offer:
        actor["hand"].append(trade_card)
        _sort_hand(actor)
        raise OasisRuleError("購入候補がなくなりました")
    price = int(offer.get("price", 0))
    if actor["gold"] < price:
        actor["hand"].append(trade_card)
        _sort_hand(actor)
        raise OasisRuleError(f"購入には￥{price}必要です")
    actor["gold"] -= price
    other["gold"] = min(99, other["gold"] + price)
    other["hand"].remove(offer)
    actor["hand"].append(offer)
    _sort_hand(actor)
    _finish_utility(
        game,
        actor,
        [(trade_card, False)],
        f'{actor["user_name"]}が{other["user_name"]}から「{offer["name"]}」を￥{price}で買いました。',
    )


def apply_action(game: dict[str, Any], user_id: str, payload: dict[str, Any]) -> None:
    if game["phase"] in {"waiting", "finished"}:
        raise OasisRuleError("対戦は進行していません")
    player = find_player(game, user_id)
    if not player or not player["alive"]:
        raise OasisRuleError("行動できる参加者ではありません")
    action = str(payload.get("action", "")).lower()
    if action == "defend":
        _defend(game, player, [str(uid) for uid in payload.get("defense_uids", [])])
        return
    actor = _actor(game)
    if actor is not player:
        raise OasisRuleError("あなたのターンではありません")
    if game["phase"].startswith("trade_"):
        if action != "trade":
            raise OasisRuleError("取引を完了またはキャンセルしてください")
        _trade(game, actor, payload)
        return
    if game["phase"] != "turn":
        raise OasisRuleError("現在は行動を選べません")
    if action == "play":
        uid = str(payload.get("card_uid", ""))
        card = _card(actor, uid)
        if not card:
            raise OasisRuleError("カードを選んでください")
        supports = [str(value) for value in payload.get("support_uids", [])]
        if (
            card["type"] == "weapon"
            or card.get("effect") == "attack_defense"
            or (
                card["type"] == "magic"
                and card.get("effect") in {"magic_attack", "magic_all_attack", "hp_drain", "inflict_status"}
            )
        ):
            _begin_attack(game, actor, uid, supports, payload.get("target_id"))
        else:
            _use_utility(game, actor, uid, payload.get("target_id"), supports)
        return
    if action == "pray":
        if any(card["type"] == "weapon" for card in actor["hand"]):
            raise OasisRuleError("武器がない時だけ祈れます")
        _draw(game, actor)
        game["logs"].insert(0, f'{actor["user_name"]}が祈り、カードを1枚授かりました。')
        _next_turn(game)
        return
    if action == "sacrifice":
        if not game["endgame"]:
            raise OasisRuleError("生贄は終末の刻だけ選べます")
        card = _card(actor, str(payload.get("card_uid", "")))
        if not card or _is_learned(actor, card["uid"]):
            raise OasisRuleError("生贄にする手札を選んでください")
        actor["hand"].remove(card)
        _draw(game, actor)
        game["logs"].insert(0, f'{actor["user_name"]}が「{card["name"]}」を生贄にしました。')
        _next_turn(game)
        return
    raise OasisRuleError("不明な行動です")


def forfeit_player(game: dict[str, Any], user_id: str) -> None:
    player = find_player(game, user_id)
    if not player:
        return
    if game["phase"] == "waiting":
        game["players"] = [
            candidate for candidate in game["players"]
            if candidate["user_id"] != player["user_id"]
        ]
        return
    if game["phase"] == "finished":
        return
    player["hp"] = 0
    player["alive"] = False
    player["result"] = "lose"
    game["logs"].insert(0, f'{player["user_name"]}が対戦を退出しました。')
    pending = game.get("pending_attack")
    if pending and pending.get("owner_id") == player["user_id"]:
        game["pending_attack"] = None
        game["battle"] = None
        if not _finish_if_needed(game):
            _next_turn(game)
        return
    if pending and pending.get("target_id") == player["user_id"]:
        _advance_attack_queue(game)
        return
    if _finish_if_needed(game):
        return
    if _actor(game) is player:
        _next_turn(game)


def public_state(game: dict[str, Any], viewer_id: str | None = None) -> dict[str, Any]:
    viewer = str(viewer_id) if viewer_id is not None else None
    viewer_player = find_player(game, viewer) if viewer else None
    fogged = bool(viewer_player and "fog" in viewer_player["statuses"])
    players = []
    for index, player in enumerate(game["players"]):
        own = player["user_id"] == viewer
        record = {
            "user_id": player["user_id"],
            "user_name": player["user_name"],
            "ready": player["ready"],
            "hp": player["hp"],
            "mp": player["mp"],
            "gold": player["gold"],
            "statuses": list(player["statuses"]),
            "guardian": deepcopy(player["guardian"]),
            "alive": player["alive"],
            "hand_count": len(player["hand"]),
            "learned_magic_count": len(player["learned_magics"]),
            "is_me": own,
            "is_turn": game["phase"] not in {"waiting", "finished"} and index == game["turn_index"],
            "result": player["result"],
        }
        if own:
            record["hand"] = deepcopy(player["hand"])
            record["learned_magics"] = deepcopy(player["learned_magics"])
        elif fogged:
            record["hp"] = None
            record["mp"] = None
            record["gold"] = None
            record["statuses"] = []
            record["guardian"] = None
        players.append(record)
    pending = game.get("pending_attack")
    can_defend = bool(
        viewer
        and game["phase"] == "defense"
        and pending
        and pending.get("target_id") == viewer
    )
    return {
        "ok": True,
        "game": {
            "room_id": game["room_id"],
            "rate": game["rate"],
            "phase": game["phase"],
            "host_user_id": game["host_user_id"],
            "turn_count": game["turn_count"],
            "end_time_limit": game["end_time_limit"],
            "endgame": game["endgame"],
            "players": players,
            "battle": deepcopy(game.get("battle")),
            "pending_trade": deepcopy(game.get("pending_trade")) if _actor(game)["user_id"] == viewer and game["phase"].startswith("trade_") else None,
            "can_defend": can_defend,
            "logs": list(game["logs"][:30]),
            "winner_ids": list(game["winner_ids"]),
            "pot": game["pot"],
        },
    }
