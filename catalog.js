// God Field-inspired built-in catalog. Display names are remixed for Oasis Field.
let oasisCatalogSequence = 0;

const OASIS_NAME_RULES = [
  ["神", "星"], ["天", "空"], ["鬼", "獣"], ["月光", "月影"],
  ["エンゼル", "翼"], ["スマイル", "ほほえみ"], ["ハート", "こころ"],
  ["ロマンス", "夢見"], ["スカイ", "蒼空"], ["アイアン", "黒鉄"],
  ["フレイム", "紅炎"], ["アクア", "清流"], ["地球", "大地"],
  ["守護", "精霊"], ["ゴースト", "幽玄"], ["マジカル", "魔導"]
];

function oasisCardName(sourceName) {
  let result = sourceName;
  OASIS_NAME_RULES.forEach(([from, to]) => { result = result.replace(from, to); });
  return result === sourceName ? `${sourceName}・翠` : result;
}

function oasisArtPath(index) {
  const artIndex = ((index - 1) % 250) + 1;
  return `cards/generated/art-${String(artIndex).padStart(3, "0")}.webp`;
}

function catalogCard(sourceName, type, values = {}) {
  oasisCatalogSequence += 1;
  const attack = values.attack || 0;
  const defense = values.defense || 0;
  const heal = values.heal || 0;
  return {
    id: `oasis_catalog_${String(oasisCatalogSequence).padStart(3, "0")}`,
    sourceName,
    name: oasisCardName(sourceName),
    type,
    icon: values.icon || "",
    image: oasisArtPath(oasisCatalogSequence),
    attack,
    defense,
    heal,
    effect: values.effect || (type === "weapon" ? "attack" : type === "enchant" ? "defense" : "custom"),
    effectPower: values.effectPower ?? (heal || attack),
    effectChance: values.effectChance ?? 100,
    hitCount: values.hitCount || 1,
    isAllAttack: Boolean(values.isAllAttack),
    secondaryValue: values.secondaryValue || 0,
    mpCost: values.mpCost || 0,
    target: values.target || "enemy",
    statusEffect: values.statusEffect || "none",
    cureStatuses: values.cureStatuses || [],
    element: values.element || "none",
    catalogGroup: values.catalogGroup || type,
    desc: values.desc || `${oasisCardName(sourceName)}の力を解放する。`
  };
}

function weapon(name, attack, options = {}) {
  return catalogCard(name, "weapon", { attack, catalogGroup: "single_weapon", ...options });
}

function allWeapon(name, attack, chance, defense, options = {}) {
  return catalogCard(name, "weapon", {
    attack, defense, effect: "all_attack", effectChance: chance, isAllAttack: true,
    target: "all_enemies", catalogGroup: "all_weapon", ...options
  });
}

function armor(name, defense, options = {}) {
  return catalogCard(name, "enchant", { defense, catalogGroup: "armor", ...options });
}

function magic(name, mpCost, options = {}) {
  return catalogCard(name, "magic", { mpCost, catalogGroup: "magic", ...options });
}

function item(name, options = {}) {
  return catalogCard(name, "item", { catalogGroup: "item", ...options });
}

const OASIS_SINGLE_WEAPONS = [
  weapon("銅のこん棒", 1), weapon("銀のこん棒", 1), weapon("金のこん棒", 1),
  weapon("ムチ", 2), weapon("セイバーロッド", 2, { defense: 6 }), weapon("パンチ", 3),
  weapon("のこぶんぶん", 3, { effect: "multi_hit", hitCount: 2 }), weapon("ハチェット", 4),
  weapon("とげベルト", 4, { defense: 2 }), weapon("鎖ガマ", 5), weapon("打撃の鉄板", 5, { defense: 7 }),
  weapon("乱弾武剣", 5, { effect: "reflect_normal" }), weapon("硬いつち", 6),
  weapon("エルボーサック", 6, { defense: 3 }), weapon("なぎなたクラシック", 7),
  weapon("ゴーストソード", 7, { effect: "hp_drain" }), weapon("ファイナル牙", 8),
  weapon("地獄のハサミ", 8, { effect: "inflict_status", statusEffect: "hell" }), weapon("パワーハルベルト", 9),
  weapon("疾風剣", 9, { effect: "inflict_status", statusEffect: "cold" }), weapon("ワンダーソード", 10),
  weapon("いんちきスピア", 10, { effect: "inflict_status", statusEffect: "dream" }),
  weapon("ソードシールド", 10, { defense: 10 }), weapon("反射剣", 10, { effect: "reflect_normal" }),
  weapon("月光のオノ", 10, { effect: "reflect_magic" }), weapon("グラビティメイス", 11),
  weapon("エンゼルナイフ", 11, { effect: "nullify_magic" }),
  weapon("六角凶", 11, { effect: "inflict_status", statusEffect: "dark_cloud" }), weapon("もろぶっこみアクス", 12),
  weapon("リアルゴーストソード", 12, { effect: "hp_drain" }), weapon("精霊の杖", 12, { effect: "mp_free_magic" }),
  weapon("絶景のヤリ", 13), weapon("激烈疾風剣", 13, { effect: "inflict_status", statusEffect: "cold" }),
  weapon("伝説の剣のさや", 13, { defense: 1 }), weapon("エンゼルソード", 13, { effect: "nullify_magic" }),
  weapon("暴れフレイル", 14), weapon("邪神の大剣", 14, { effect: "self_damage" }),
  weapon("ドラゴンクロウ", 15), weapon("エンゼルアクス", 15, { effect: "nullify_magic" }),
  weapon("神の剣", 30), weapon("マジカルステッキ", 0, { effect: "mp_scaled_attack", effectPower: 2 }),
  weapon("たいまつ", 1, { element: "fire" }), weapon("あちちナイフ", 2, { element: "fire" }),
  weapon("燃えムチ", 3, { element: "fire" }), weapon("ほむら巻き", 4, { defense: 4, element: "fire" }),
  weapon("ブレイズブレイド", 5, { element: "fire" }), weapon("火竜一角", 8, { element: "fire" }),
  weapon("つらら", 1, { element: "water" }),
  weapon("霧鉄砲", 3, { element: "water", effect: "inflict_status", statusEffect: "fog" }),
  weapon("氷結ハンマー", 4, { element: "water" }), weapon("水竜一角", 8, { element: "water" }),
  weapon("木刀", 1, { element: "wood" }), weapon("いばらのムチ", 2, { element: "wood" }),
  weapon("いがナッツ", 3, { element: "wood" }),
  weapon("夢の木づち", 4, { element: "wood", effect: "inflict_status", statusEffect: "dream" }),
  weapon("風のカギ爪", 1, { element: "earth", effect: "inflict_status", statusEffect: "cold" }),
  weapon("つるぎ焼き", 2, { element: "earth" }), weapon("ダイヤモンドソード", 13, { element: "earth" }),
  weapon("フラッシュダガー", 2, { element: "light", effect: "inflict_status", statusEffect: "flash" }),
  weapon("スタースタッフ", 3, { element: "light" }), weapon("ジャスティスランス", 5, { element: "light" }),
  weapon("聖剣", 9, { element: "light" }), weapon("あぶないキネ", 30, { element: "light", effect: "random_target" }),
  weapon("ちくりんちょ", 1, { element: "dark" }), weapon("コブラ", 3, { element: "dark" }),
  weapon("さよならの剣", 4, { element: "dark" }), weapon("キラーフォーク", 5, { element: "dark" }),
  weapon("死神のカマ", 10, { element: "dark" })
];

const OASIS_ADDITIONAL_WEAPONS = [
  ["吹き矢", 1], ["クロスボウ", 2], ["ブーメラン", 3], ["バトルボール", 4], ["戦士の弓", 5],
  ["ジェットヨーヨー", 6], ["未知の羽根", 7], ["サイキックカード", 8], ["スカイハープーン", 9],
  ["恐怖の車輪", 11], ["独楽コンバット", 13], ["エンゼルの弓", 15],
  ["発火のワンド", 2, "fire"], ["ファイヤークロスボウ", 4, "fire"], ["魔水のワンド", 5, "water"],
  ["葉っぱ手裏剣", 2, "wood"], ["熟成ゴムの弓", 3, "wood"], ["旧石器ジャベリン", 5, "earth"],
  ["新石器トマホーク", 7, "earth"], ["輝きのカケラ", 1, "light"], ["冥矢", 5, "dark"]
].map(([name, attack, element = "none"]) => weapon(name, attack, {
  element, effect: "add_attack", catalogGroup: "additional_weapon"
}));

const OASIS_ALL_WEAPONS = [
  allWeapon("火の粉袋", 1, 75, 2, { element: "fire" }), allWeapon("火炎杯", 4, 75, 6, { element: "fire" }),
  allWeapon("烈火シャワー", 7, 75, 10, { element: "fire" }), allWeapon("フレアアクス", 10, 50, 10, { element: "fire" }),
  allWeapon("霧の扇", 3, 50, 8, { element: "water", statusEffect: "fog" }), allWeapon("冷気杯", 4, 75, 6, { element: "water" }),
  allWeapon("特大雪玉", 5, 50, 5, { element: "water" }), allWeapon("雨神刀", 9, 50, 9, { element: "water" }),
  allWeapon("つるシュート", 3, 75, 10, { element: "wood", effect: "hp_drain" }),
  allWeapon("植物杯", 4, 75, 6, { element: "wood" }), allWeapon("魔神の木馬", 8, 75, 6, { element: "wood" }),
  allWeapon("岩石杯", 4, 75, 6, { element: "earth" }), allWeapon("ガケッツチ", 6, 25, 4, { element: "earth" }),
  allWeapon("プチサターン", 20, 25, 15, { element: "earth" }), allWeapon("イナヅマキッズ", 3, 25, 2, { element: "light" }),
  allWeapon("光のオーブ", 6, 75, 10, { element: "light" }), allWeapon("昇天弓", 1, 25, 10, { element: "light" }),
  allWeapon("シャドウハンド", 2, 50, 8, { element: "dark", effect: "instant_defeat" })
];

const OASIS_ARMORS = [
  armor("革の帽子", 1), armor("スカイブーツ", 1, { effect: "reflect_magic" }), armor("革の服", 2),
  armor("アイアンガントレット", 3), armor("鬼のくつ", 3, { attack: 5, effect: "attack_defense" }),
  armor("スカイガントレット", 3, { effect: "reflect_magic" }), armor("アイアンシールド", 4), armor("アイアンアーマー", 5),
  armor("鬼の小手", 5, { attack: 10, effect: "attack_defense" }), armor("スカイヘルム", 5, { effect: "reflect_magic" }),
  armor("はがねの小手", 6), armor("精霊の足袋", 6, { effect: "mp_free_magic" }), armor("はがねのかぶと", 7),
  armor("鬼のかぶと", 7, { attack: 10, effect: "attack_defense" }), armor("スカイシールド", 7, { effect: "reflect_magic" }),
  armor("はがねの盾", 8), armor("美しいガラス細工", 8), armor("月光のかぶと", 8, { effect: "reflect_magic" }),
  armor("はがねのよろい", 9), armor("鬼のよろい", 9, { attack: 15, effect: "attack_defense" }),
  armor("精霊の頭巾", 9, { effect: "mp_free_magic" }), armor("スカイアーマー", 9, { effect: "reflect_magic" }),
  armor("エンゼルの小手", 9, { effect: "nullify_magic" }), armor("エナジーヘルム", 10),
  armor("月光の盾", 10, { effect: "reflect_magic" }), armor("エナジーアーマー", 11),
  armor("エンゼルの帽子", 11, { effect: "nullify_magic" }), armor("コアバリヤー", 12),
  armor("精霊の帯", 12, { effect: "mp_free_magic" }), armor("月光のよろい", 12, { effect: "reflect_magic" }),
  armor("コアプロテクター", 13), armor("エンゼルシールド", 13, { effect: "nullify_magic" }),
  armor("エンゼルアーマー", 15, { effect: "nullify_magic" }), armor("神の盾", 30),
  armor("火花の小手", 2, { element: "fire" }), armor("フレイムブーツ", 3, { element: "fire" }),
  armor("フレイムメット", 4, { element: "fire" }), armor("フレイムシールド", 5, { element: "fire" }),
  armor("フレイムアーマー", 6, { element: "fire" }), armor("バーニングシールド", 7, { element: "fire" }),
  armor("バーニングジャケット", 8, { element: "fire" }),
  armor("熱狂仮面", 10, { element: "fire", effect: "inflict_status", statusEffect: "fever", target: "self" }),
  armor("陽炎のよろい", 12, { element: "fire" }), armor("アクアシューズ", 1, { element: "water" }),
  armor("アクアグローブ", 2, { element: "water" }), armor("アイスブーツ", 3, { element: "water" }),
  armor("アイスヘルム", 4, { element: "water" }), armor("アイスシールド", 5, { element: "water" }),
  armor("アイスアーマー", 6, { element: "water" }), armor("スノーミトン", 7, { element: "water" }),
  armor("スノーマスク", 8, { element: "water" }), armor("草かんむり", 1, { element: "wood" }),
  armor("木の盾", 2, { element: "wood" }), armor("御神木の小手", 3, { element: "wood" }),
  armor("林の盾", 4, { element: "wood" }), armor("樹脂で編んだ法衣", 5, { element: "wood" }),
  armor("森の盾", 6, { element: "wood" }), armor("コハクの胸当て", 8, { element: "wood" }),
  armor("夢見る帽子", 14, { element: "wood", effect: "inflict_status", statusEffect: "dream", target: "self" }),
  armor("石版", 1, { element: "earth" }), armor("岩盤", 2, { element: "earth" }), armor("結晶板", 3, { element: "earth" }),
  armor("大地のくつ", 4, { element: "earth" }), armor("大地の小手", 5, { element: "earth" }),
  armor("大地のかぶと", 6, { element: "earth" }), armor("大地のよろい", 8, { element: "earth" }),
  armor("ぴかぴかハイヒール", 6, { element: "light" }), armor("きらきらドレス", 10, { element: "light" }),
  armor("火星の指輪", 0, { element: "fire", effect: "counter_attack", effectChance: 75 }),
  armor("水星の指輪", 0, { element: "water", effect: "inflict_status", statusEffect: "fog" }),
  armor("木星の指輪", 0, { element: "wood", effect: "inflict_status", statusEffect: "dream" }),
  armor("土星の指輪", 0, { element: "earth", effect: "counter_attack", effectPower: 2 }),
  armor("天王の指輪", 0, { element: "light", effect: "inflict_status", statusEffect: "flash" }),
  armor("冥王の指輪", 0, { element: "dark", effect: "inflict_status", statusEffect: "dark_cloud" }),
  armor("海王の指輪", 0, { effect: "heal_mp", effectPower: 2 }), armor("金星の指輪", 0, { effect: "custom" }),
  armor("虹のカーテン", 0, { effect: "element_change" }), armor("スーパーミラー", 0, { effect: "reflect_normal" })
];

const OASIS_MAGICS = [
  magic("＜火の玉＞", 2, { attack: 2, effect: "magic_attack", element: "fire" }),
  magic("＜煙＞", 4, { attack: 5, effectPower: 5, effectChance: 75, effect: "magic_all_attack", element: "fire", target: "all_enemies" }),
  magic("＜炎＞", 5, { attack: 10, effectPower: 10, effect: "magic_attack", element: "fire" }),
  magic("＜マグマ＞", 10, { attack: 15, effectPower: 15, effectChance: 75, effect: "magic_all_attack", element: "fire", target: "all_enemies" }),
  magic("＜氷＞", 2, { attack: 4, effectPower: 4, effect: "magic_attack", element: "water" }),
  magic("＜雪崩＞", 6, { attack: 8, effectPower: 8, effectChance: 75, effect: "magic_all_attack", element: "water", target: "all_enemies" }),
  magic("＜滝＞", 12, { attack: 25, effectPower: 25, effect: "magic_attack", element: "water" }),
  magic("＜氷河期＞", 30, { attack: 30, effectPower: 30, effectChance: 75, effect: "magic_all_attack", element: "water", target: "all_enemies" }),
  magic("＜大木＞", 3, { attack: 6, effectPower: 6, effect: "magic_attack", element: "wood" }),
  magic("＜岩＞", 4, { attack: 8, effectPower: 8, effect: "magic_attack", element: "earth" }),
  magic("＜土石流＞", 6, { attack: 12, effectPower: 12, effectChance: 50, effect: "magic_all_attack", element: "earth", target: "all_enemies" }),
  magic("＜閃光＞", 3, { attack: 1, effectPower: 1, effectChance: 25, effect: "inflict_status", statusEffect: "flash", element: "light" }),
  magic("＜雷＞", 4, { attack: 10, effectPower: 10, effectChance: 25, effect: "magic_all_attack", element: "light", target: "all_enemies" }),
  magic("＜流星＞", 7, { attack: 10, effectPower: 10, effect: "magic_attack", element: "light" }),
  magic("＜吸収＞", 10, { attack: 10, effectPower: 10, effect: "hp_drain", element: "light" }),
  magic("＜闇＞", 5, { attack: 5, effectPower: 5, effect: "magic_attack", element: "dark" }),
  magic("＜風＞", 6, { effect: "inflict_status", statusEffect: "cold" }),
  magic("＜天国風＞", 15, { effect: "inflict_status", statusEffect: "heaven" }),
  magic("＜霧＞", 3, { effect: "inflict_status", statusEffect: "fog", element: "water" }),
  magic("＜夢＞", 6, { effect: "inflict_status", statusEffect: "dream", element: "wood" }),
  magic("＜暗雲＞", 5, { effect: "inflict_status", statusEffect: "dark_cloud", element: "dark" }),
  magic("＜音色＞", 2, { effect: "cure_status", statusEffect: "cold", target: "self" }),
  magic("＜歌声＞", 5, { effect: "cure_status", statusEffect: "all", target: "self" }),
  magic("＜オーラ＞", 6, { effect: "boost_attack", effectPower: 10, target: "self" }),
  magic("＜蜃気楼＞", 5, { effect: "boost_attack", effectPower: 20, target: "self" }),
  magic("＜乱気流＞", 5, { effect: "reflect_magic", target: "self" }),
  magic("＜壁＞", 6, { effect: "nullify_magic", target: "self" }),
  magic("＜泉＞", 7, { heal: 10, effectPower: 10, effect: "heal_hp", target: "self" }),
  magic("＜財宝＞", 5, { effectPower: 10, effect: "custom", target: "self" }),
  magic("＜解放＞", 15, { effect: "summon_guardian", target: "self" })
];

const OASIS_ITEMS = [
  item("スマイルのしずく", { heal: 5, effectPower: 5, effect: "heal_hp", target: "self" }),
  item("ハートのしずく", { heal: 10, effectPower: 10, effect: "heal_hp", target: "self" }),
  item("ロマンスウォーター", { heal: 15, effectPower: 15, effect: "heal_hp", target: "self" }),
  item("天の川のおいしい水", { heal: 20, effectPower: 20, effect: "heal_hp", target: "self" }),
  item("スマイルの花", { effectPower: 5, effect: "heal_mp", target: "self" }),
  item("ハートの花", { effectPower: 10, effect: "heal_mp", target: "self" }),
  item("ロマンスの香木", { effectPower: 15, effect: "heal_mp", target: "self" }),
  item("天国草", { effectPower: 20, effect: "heal_mp", statusEffect: "heaven", target: "self" }),
  item("スマイルの貝がら", { effect: "cure_status", statusEffect: "cold", cureStatuses: ["cold", "fever", "fog", "flash"], target: "self" }),
  item("ハートの貝がら", { effect: "cure_status", statusEffect: "all", target: "self" }),
  item("守護封印のつぼ", { effect: "summon_guardian", target: "self" }),
  item("ドキドキ涙", { effectPower: 10, effect: "random_heal_damage", target: "self" }),
  item("ちからの粉", { effectPower: 10, effect: "boost_attack", target: "self" }),
  item("精霊のぬいぐるみ", { effect: "mp_free_magic", target: "self" }),
  item("夜空のホウキ", { effectPower: 3, effect: "discard", target: "enemy" }),
  item("女神の石けん", { effectPower: 2, effect: "forget_magic", target: "enemy" }),
  item("運命のひも", { effect: "random_event", target: "all_players" }),
  item("太陽のお守り", { effectPower: 10, effect: "revive", target: "self" }),
  item("あぶないウス", { effectPower: 1, effect: "custom", target: "self" }),
  item("両替", { effect: "trade", target: "self" }), item("売る", { effect: "trade", target: "enemy" }),
  item("買う", { effect: "trade", target: "enemy" }),
  item("小悪魔", { effectPower: 10, effect: "self_damage", target: "self" }),
  item("中悪魔", { effectPower: 20, effect: "self_damage", target: "self" }),
  item("大悪魔", { effectPower: 30, effect: "self_damage", target: "self" }),
  item("イタズラマン", { effectPower: 2, effect: "discard", target: "self" }),
  item("めぐみの妖精", { effectPower: 10, effect: "random_event", target: "self" })
];

const OASIS_CATALOG_CARDS = [
  ...OASIS_SINGLE_WEAPONS,
  ...OASIS_ADDITIONAL_WEAPONS,
  ...OASIS_ALL_WEAPONS,
  ...OASIS_ARMORS,
  ...OASIS_MAGICS,
  ...OASIS_ITEMS
];

const OASIS_CATALOG_COUNTS = OASIS_CATALOG_CARDS.reduce((counts, card) => {
  counts[card.catalogGroup] = (counts[card.catalogGroup] || 0) + 1;
  return counts;
}, {});
