import random
import unittest
from unittest.mock import patch

import oasisfield_logic as rules


def card(name):
    return rules._copy_card(rules.CATALOG_BY_NAME[name])


class OasisFieldRulesTest(unittest.TestCase):
    def setUp(self):
        random.seed(661)
        self.game = rules.new_game(
            "TEST",
            "GUILD",
            0,
            "1",
            [
                {"user_id": "1", "user_name": "A"},
                {"user_id": "2", "user_name": "B"},
                {"user_id": "3", "user_name": "C"},
            ],
            75,
        )
        for player in self.game["players"]:
            player["ready"] = True
        rules.start_game(self.game, "1")

    def make_actor(self, user_id="1"):
        index = next(
            index
            for index, player in enumerate(self.game["players"])
            if player["user_id"] == user_id
        )
        self.game["turn_index"] = index
        self.game["phase"] = "turn"
        return self.game["players"][index]

    def test_catalog_and_starting_state(self):
        self.assertEqual(len(rules.CATALOG), 242)
        self.assertEqual(self.game["end_time_limit"], 75)
        self.assertEqual(len(self.game["players"]), 3)
        self.assertTrue(all(len(player["hand"]) == 9 for player in self.game["players"]))
        self.assertEqual(self.game["pot"], 0)

    def test_all_end_time_limits_are_preserved(self):
        for limit in sorted(rules.END_LIMITS):
            game = rules.new_game(
                f"TEST-{limit}",
                "GUILD",
                0,
                "1",
                [
                    {"user_id": "1", "user_name": "A"},
                    {"user_id": "2", "user_name": "B"},
                ],
                limit,
            )
            self.assertEqual(game["end_time_limit"], limit)

    def test_normal_armor_is_defense_only_but_attack_armor_is_allowed(self):
        actor = self.make_actor()
        armor = card("革の帽子")
        actor["hand"] = [armor]
        with self.assertRaisesRegex(rules.OasisRuleError, "攻撃を受けた時"):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": armor["uid"],
                    "target_id": actor["user_id"],
                },
            )
        self.assertEqual(self.game["phase"], "turn")
        self.assertEqual(actor["hand"][0]["uid"], armor["uid"])

        attack_armor = card("鬼のくつ")
        actor["hand"] = [attack_armor]
        with self.assertRaisesRegex(rules.OasisRuleError, "武器がない時"):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {"action": "pray"},
            )
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": attack_armor["uid"],
                "target_id": "2",
            },
        )
        self.assertEqual(
            self.game["pending_attack"]["primary"]["effect"],
            "attack_defense",
        )

    def test_support_magic_and_spirit_order(self):
        actor = self.make_actor()
        actor["hand"] = [card("銅のこん棒"), card("＜オーラ＞"), card("精霊のぬいぐるみ")]
        weapon, aura, spirit = actor["hand"]
        actor["mp"] = 0
        rules._begin_attack(
            self.game,
            actor,
            weapon["uid"],
            [aura["uid"], spirit["uid"]],
            "2",
        )
        self.assertEqual(self.game["pending_attack"]["attack"], 2)
        self.assertEqual(actor["mp"], 0)

    def test_all_attack_rejects_support(self):
        actor = self.make_actor()
        actor["hand"] = [card("魔神の木馬"), card("＜オーラ＞")]
        with self.assertRaises(rules.OasisRuleError):
            rules._begin_attack(
                self.game,
                actor,
                actor["hand"][0]["uid"],
                [actor["hand"][1]["uid"]],
                None,
            )

    def test_flash_limits_defense_to_one(self):
        defender = rules.find_player(self.game, "2")
        defender["statuses"] = ["flash"]
        defender["hand"] = [card("革の帽子"), card("革の服")]
        self.game["phase"] = "defense"
        self.game["pending_attack"] = {
            "target_id": "2",
            "attacker_id": "1",
            "owner_id": "1",
            "primary": card("銅のこん棒"),
            "attack": 1,
            "hit_count": 1,
            "element": "none",
            "is_magic": False,
            "hit": True,
            "draw_counts": {},
            "targets": ["2"],
            "target_index": 0,
            "cards": [],
            "after_resolution": "next_turn",
        }
        with self.assertRaises(rules.OasisRuleError):
            rules._defend(
                self.game,
                defender,
                [defender["hand"][0]["uid"], defender["hand"][1]["uid"]],
            )

    def test_non_defense_card_is_rejected_without_consuming_it(self):
        actor = self.make_actor()
        defender = rules.find_player(self.game, "2")
        weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "none"
            and not candidate.get("isAllAttack")
        )
        healing_item = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "item"
            and candidate.get("effect") == "heal_hp"
        )
        actor["hand"] = [rules._copy_card(weapon)]
        defender["hand"] = [rules._copy_card(healing_item)]
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": actor["hand"][0]["uid"],
                "target_id": defender["user_id"],
            },
        )
        item_uid = defender["hand"][0]["uid"]
        with self.assertRaises(rules.OasisRuleError):
            rules.apply_action(
                self.game,
                defender["user_id"],
                {"action": "defend", "defense_uids": [item_uid]},
            )
        self.assertTrue(any(card["uid"] == item_uid for card in defender["hand"]))
        self.assertEqual(self.game["phase"], "defense")

    def test_missed_all_attack_advances_without_defense_input(self):
        actor = self.make_actor()
        attack = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("isAllAttack")
            and int(candidate.get("effectChance", 100)) < 100
        )
        actor["hand"] = [rules._copy_card(attack)]
        with patch("oasisfield_logic.random.randrange", return_value=99):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": actor["hand"][0]["uid"],
                },
            )
        self.assertEqual(self.game["phase"], "turn")
        self.assertIsNone(self.game["pending_attack"])
        self.assertIsNone(self.game["battle"])

    def test_normal_attack_rejects_self_target_without_consuming_card(self):
        actor = self.make_actor()
        weapon = next(
            card(item["sourceName"])
            for item in rules.CATALOG
            if item["type"] == "weapon"
            and item.get("effect") not in {"random_target", "all_attack"}
            and not item.get("isAllAttack")
            and item.get("target") != "all_enemies"
        )
        actor["hand"] = [weapon]

        with self.assertRaisesRegex(rules.OasisRuleError, "自分を攻撃対象"):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": weapon["uid"],
                    "target_id": actor["user_id"],
                },
            )

        self.assertEqual(self.game["phase"], "turn")
        self.assertEqual(actor["hand"][0]["uid"], weapon["uid"])

    def test_random_target_attack_can_randomly_hit_its_user(self):
        actor = self.make_actor()
        random_weapon = next(
            rules._copy_card(item)
            for item in rules.CATALOG
            if item.get("effect") == "random_target"
        )
        actor["hand"] = [random_weapon]

        with (
            patch("oasisfield_logic.random.choice", return_value=actor["user_id"]),
            patch("oasisfield_logic._hit", return_value=True),
            patch("oasisfield_logic._defend"),
        ):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": random_weapon["uid"],
                    "target_id": actor["user_id"],
                },
            )

        self.assertEqual(
            self.game["pending_attack"]["target_id"],
            actor["user_id"],
        )

    def test_all_attack_excludes_its_user(self):
        actor = self.make_actor()
        all_attack = next(
            rules._copy_card(item)
            for item in rules.CATALOG
            if item["type"] == "weapon"
            and (
                item.get("isAllAttack")
                or item.get("target") == "all_enemies"
                or item.get("effect") == "all_attack"
            )
        )
        actor["hand"] = [all_attack]

        with patch("oasisfield_logic._hit", return_value=True):
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": all_attack["uid"],
                    "target_id": actor["user_id"],
                },
            )

        self.assertNotIn(
            actor["user_id"],
            self.game["pending_attack"]["targets"],
        )

    def test_rainbow_curtain_allows_any_defense_element(self):
        actor = self.make_actor()
        defender = rules.find_player(self.game, "2")
        fire_weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "fire"
            and not candidate.get("isAllAttack")
        )
        rainbow = next(
            candidate
            for candidate in rules.CATALOG
            if candidate.get("effect") == "element_change"
        )
        fire_armor = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "armor"
            and candidate.get("element") == "fire"
            and int(candidate.get("defense", 0)) > 0
        )
        actor["hand"] = [rules._copy_card(fire_weapon)]
        defender["hand"] = [
            rules._copy_card(rainbow),
            rules._copy_card(fire_armor),
        ]
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": actor["hand"][0]["uid"],
                "target_id": defender["user_id"],
            },
        )
        defense_uids = [card["uid"] for card in defender["hand"]]
        rules.apply_action(
            self.game,
            defender["user_id"],
            {"action": "defend", "defense_uids": defense_uids},
        )
        self.assertEqual(defender["hp"], 40)
        self.assertTrue(
            all(
                card["uid"] not in defense_uids
                for card in defender["hand"]
            )
        )

    def test_rainbow_curtain_removes_dark_instant_defeat(self):
        actor = self.make_actor()
        defender = rules.find_player(self.game, "2")
        dark_weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "dark"
            and candidate.get("effect") == "attack"
            and not candidate.get("isAllAttack")
        )
        rainbow = next(
            candidate
            for candidate in rules.CATALOG
            if candidate.get("effect") == "element_change"
        )
        actor["hand"] = [rules._copy_card(dark_weapon)]
        defender["hand"] = [rules._copy_card(rainbow)]
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": actor["hand"][0]["uid"],
                "target_id": defender["user_id"],
            },
        )
        rules.apply_action(
            self.game,
            defender["user_id"],
            {
                "action": "defend",
                "defense_uids": [defender["hand"][0]["uid"]],
            },
        )
        self.assertEqual(defender["hp"], 40 - int(dark_weapon["attack"]))
        self.assertTrue(defender["alive"])

    def test_flash_allows_one_compatible_element_defense(self):
        actor = self.make_actor()
        defender = rules.find_player(self.game, "2")
        defender["statuses"] = ["flash"]
        fire_weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "fire"
            and not candidate.get("isAllAttack")
        )
        water_armor = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "armor"
            and candidate.get("element") == "water"
            and int(candidate.get("defense", 0)) > 0
        )
        actor["hand"] = [rules._copy_card(fire_weapon)]
        defender["hand"] = [rules._copy_card(water_armor)]
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": actor["hand"][0]["uid"],
                "target_id": defender["user_id"],
            },
        )
        rules.apply_action(
            self.game,
            defender["user_id"],
            {
                "action": "defend",
                "defense_uids": [defender["hand"][0]["uid"]],
            },
        )
        self.assertEqual(defender["hp"], 40)

    def test_super_mirror_reflects_elemental_attack_without_reroll(self):
        actor = self.make_actor()
        defender = rules.find_player(self.game, "2")
        fire_weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "fire"
            and not candidate.get("isAllAttack")
        )
        super_mirror = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "armor"
            and candidate.get("effect") == "reflect_normal"
        )
        actor["hand"] = [
            rules._copy_card(fire_weapon),
            rules._copy_card(super_mirror),
        ]
        defender["hand"] = [rules._copy_card(super_mirror)]
        with patch("oasisfield_logic._hit", return_value=True) as hit:
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "play",
                    "card_uid": actor["hand"][0]["uid"],
                    "target_id": defender["user_id"],
                },
            )
            rules.apply_action(
                self.game,
                defender["user_id"],
                {
                    "action": "defend",
                    "defense_uids": [defender["hand"][0]["uid"]],
                },
            )
            actor_mirror = next(
                card
                for card in actor["hand"]
                if card.get("effect") == "reflect_normal"
            )
            rules.apply_action(
                self.game,
                actor["user_id"],
                {
                    "action": "defend",
                    "defense_uids": [actor_mirror["uid"]],
                },
            )
            self.assertEqual(hit.call_count, 1)
        self.assertEqual(self.game["phase"], "defense")
        self.assertTrue(self.game["pending_attack"]["hit"])
        self.assertEqual(self.game["pending_attack"]["target_id"], defender["user_id"])
        self.assertEqual(self.game["pending_attack"]["chain"], 2)

    def test_bounced_attack_can_be_bounced_again(self):
        actor = self.make_actor()
        first_defender = rules.find_player(self.game, "2")
        second_defender = rules.find_player(self.game, "3")
        weapon = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("element") == "none"
            and not candidate.get("isAllAttack")
            and candidate.get("effect") == "attack"
        )
        bounce = next(
            candidate
            for candidate in rules.CATALOG
            if candidate["type"] == "weapon"
            and candidate.get("effect") == "reflect_normal"
            and candidate.get("reflectionMode") == "bounce"
        )
        actor["hand"] = [rules._copy_card(weapon)]
        first_defender["hand"] = [rules._copy_card(bounce)]
        second_defender["hand"] = [rules._copy_card(bounce)]
        rules.apply_action(
            self.game,
            actor["user_id"],
            {
                "action": "play",
                "card_uid": actor["hand"][0]["uid"],
                "target_id": first_defender["user_id"],
            },
        )
        with patch(
            "oasisfield_logic.random.choice",
            side_effect=[second_defender["user_id"], actor["user_id"]],
        ):
            rules.apply_action(
                self.game,
                first_defender["user_id"],
                {
                    "action": "defend",
                    "defense_uids": [first_defender["hand"][0]["uid"]],
                },
            )
            rules.apply_action(
                self.game,
                second_defender["user_id"],
                {
                    "action": "defend",
                    "defense_uids": [second_defender["hand"][0]["uid"]],
                },
            )
        self.assertEqual(self.game["phase"], "defense")
        self.assertEqual(self.game["pending_attack"]["target_id"], actor["user_id"])
        self.assertEqual(self.game["pending_attack"]["chain"], 2)

    def test_sun_charm_then_ascension_bow(self):
        player = rules.find_player(self.game, "2")
        player["hand"] = [card("太陽のお守り")]
        player["hp"] = 5
        rules._damage(self.game, player, 5)
        self.assertEqual(player["hp"], 10)
        self.assertFalse(self.game["ascension_queue"])

        player["hand"] = [card("昇天弓")]
        player["hp"] = 5
        rules._damage(self.game, player, 5)
        self.assertEqual(player["hp"], 0)
        self.assertEqual(self.game["ascension_queue"][0]["player_id"], "2")

    def test_sell_payment_uses_gold_mp_then_hp(self):
        actor = self.make_actor()
        buyer = rules.find_player(self.game, "2")
        buyer["gold"], buyer["mp"], buyer["hp"] = 3, 4, 20
        sell = card("売る")
        sale = card("銀のこん棒")
        actor["hand"] = [sell, sale]
        self.game["pending_trade"] = {"card_uid": sell["uid"], "effect": "sell"}
        self.game["phase"] = "trade_sell"
        rules._trade(
            self.game,
            actor,
            {"target_id": "2", "card_uid": sale["uid"]},
        )
        self.assertEqual((buyer["gold"], buyer["mp"], buyer["hp"]), (0, 0, 17))
        self.assertTrue(any(item["id"] == sale["id"] for item in buyer["hand"]))

    def test_fog_hides_opponents_and_randomizes_enemy(self):
        actor = self.make_actor()
        actor["statuses"] = ["fog"]
        target = rules.find_player(self.game, "2")
        state = rules.public_state(self.game, actor["user_id"])["game"]
        hidden = next(player for player in state["players"] if player["user_id"] == target["user_id"])
        self.assertIsNone(hidden["hp"])
        weapon = card("銅のこん棒")
        with patch("oasisfield_logic.random.choice", return_value=rules.find_player(self.game, "3")):
            targets = rules._attack_targets(self.game, actor, weapon, "2")
        self.assertEqual(targets, ["3"])

    def test_endgame_draw_uses_demon_table(self):
        player = self.make_actor()
        player["hand"] = []
        self.game["endgame"] = True
        with patch("oasisfield_logic.random.random", return_value=0.0), patch(
            "oasisfield_logic.random.choices",
            return_value=["小悪魔"],
        ):
            rules._draw(self.game, player)
        self.assertEqual(player["hand"][0]["sourceName"], "小悪魔")

    def test_learned_magic_limit_is_six(self):
        player = self.make_actor()
        magics = [card_data for card_data in rules.CATALOG if card_data["type"] == "magic"][:7]
        for magic in magics:
            rules._learn(player, magic)
        self.assertEqual(len(player["learned_magics"]), 6)
        self.assertNotIn(
            magics[0]["id"],
            {known["id"] for known in player["learned_magics"]},
        )


if __name__ == "__main__":
    unittest.main()
