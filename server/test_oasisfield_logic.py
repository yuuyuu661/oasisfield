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
