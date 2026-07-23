const CARD_TYPES = {
  weapon: "武器",
  armor: "防具",
  enchant: "エンチャント",
  magic: "魔法",
  item: "アイテム"
};

const CARD_EFFECTS = {
  weapon: [
    ["attack", "通常攻撃"],
    ["add_attack", "追加攻撃"],
    ["all_attack", "全体攻撃"],
    ["multi_hit", "複数回攻撃"],
    ["hp_drain", "与えたダメージをHP吸収"],
    ["self_damage", "自分にもダメージ"],
    ["inflict_status", "ダメージ時に災いを付与"],
    ["instant_defeat", "命中時に一撃で倒す"],
    ["reflect_normal", "無属性攻撃を反射"],
    ["reflect_magic", "魔法を反射"],
    ["nullify_magic", "魔法を止める"],
    ["random_target", "対象をランダム化"],
    ["mp_scaled_attack", "MP依存攻撃"],
    ["element_change", "攻撃属性を変更"]
  ],
  enchant: [
    ["add_attack", "武器に重ねる追加攻撃"],
    ["defense", "防御"],
    ["attack_defense", "攻撃と防御"],
    ["reflect_normal", "無属性攻撃を反射"],
    ["reflect_magic", "魔法を反射"],
    ["nullify_magic", "魔法を止める"],
    ["magic_defense", "魔法防御"],
    ["evade", "確率で回避"],
    ["mp_free_magic", "MP消費なしで魔法を使用"],
    ["on_defeat_heal", "HP0時に回復"],
    ["counter_attack", "攻撃者へ反撃"],
    ["mp_gain_on_damage", "被ダメージに応じてMP回復"],
    ["steal_gold_on_damage", "被ダメージに応じてゴールド没収"],
    ["element_change", "攻撃属性を変更"]
  ],
  armor: [
    ["defense", "防御"],
    ["attack_defense", "攻撃と防御"],
    ["reflect_normal", "無属性攻撃を反射"],
    ["reflect_magic", "魔法を反射"],
    ["nullify_magic", "魔法を止める"],
    ["magic_defense", "魔法防御"],
    ["evade", "確率で回避"],
    ["mp_free_magic", "MP消費なしで魔法を使用"],
    ["on_defeat_heal", "HP0時に回復"],
    ["counter_attack", "攻撃者へ反撃"],
    ["mp_gain_on_damage", "被ダメージに応じてMP回復"],
    ["steal_gold_on_damage", "被ダメージに応じてゴールド没収"],
    ["element_change", "攻撃属性を変更"]
  ],
  magic: [
    ["magic_attack", "単体魔法攻撃"],
    ["magic_all_attack", "全体魔法攻撃"],
    ["heal_hp", "HP回復"],
    ["heal_mp", "MP回復"],
    ["hp_drain", "HP吸収"],
    ["mp_drain", "MP吸収"],
    ["inflict_status", "災いを付与"],
    ["cure_status", "災いを解除"],
    ["summon_guardian", "守護神を召喚"],
    ["gold_gain", "ゴールドを増やす"],
    ["dispel", "強化・守護を解除"],
    ["draw", "カードを引く"],
    ["double_attack", "次の単体武器を2倍"],
    ["sure_all_attack", "次の単体武器を必中全体化"],
    ["discard", "カードを捨てさせる"],
    ["revive", "復活"],
    ["random_effect", "ランダム効果"]
  ],
  item: [
    ["heal_hp", "HP回復"],
    ["heal_mp", "MP回復"],
    ["cure_status", "災いを解除"],
    ["boost_attack", "攻撃力を上げる"],
    ["mp_free_magic", "MP消費なしで魔法を使用"],
    ["random_heal_damage", "回復または自傷"],
    ["summon_guardian", "守護神を召喚"],
    ["random_event", "超常現象を起こす"],
    ["discard", "カードを捨てさせる"],
    ["forget_magic", "習得魔法を忘れさせる"],
    ["revive", "HP0時に復活"],
    ["self_damage", "自分にダメージ"],
    ["sell", "カードを売る"],
    ["buy", "カードを買う"],
    ["exchange", "HP・MP・ゴールドを両替"],
    ["custom", "自由設定"]
  ]
};

const STATUS_EFFECTS = {
  none: "なし",
  cold: "風邪",
  fever: "熱病",
  fog: "霧",
  flash: "閃光",
  dream: "夢",
  dark_cloud: "暗雲",
  hell: "地獄病",
  heaven: "天国病",
  all: "すべての災い"
};

const STATUS_DESCRIPTIONS = {
  none: "災いを付与しません。",
  cold: "ターン終了時にHP-1。5%で熱病へ悪化します。",
  fever: "ターン終了時にHP-2。5%で地獄病へ悪化します。",
  hell: "ターン終了時にHP-5。5%で天国病へ悪化します。",
  heaven: "ターン終了時にHP+5。5%で発作が起きHP0になります。",
  fog: "神器の個別対象を指定できなくなり、相手のHP・MP・災い情報が見えなくなります。",
  flash: "防御時に使用できるカードが1枚になります。",
  dream: "神器が50%の確率で別のカードに見えます。治癒すると本来の表示へ戻ります。",
  dark_cloud: "受ける全体攻撃が必ず命中します。",
  all: "付与済みの災いをすべて解除します。"
};

const TARGET_TYPES = {
  enemy: "敵1人",
  all_enemies: "敵全員",
  self: "自分",
  ally: "味方1人",
  all_players: "全員",
  random: "ランダム"
};

function cardTypeLabel(type) {
  return CARD_TYPES[type] || type;
}

function cardEffectLabel(type, effect) {
  return (CARD_EFFECTS[type] || []).find(([value]) => value === effect)?.[1] || effect || "効果なし";
}
