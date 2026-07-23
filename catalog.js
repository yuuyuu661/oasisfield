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
    price: values.price ?? 0,
    drawRate: values.drawRate ?? 0.2,
    mpCost: values.mpCost || 0,
    target: values.target || "enemy",
    statusEffect: values.statusEffect || "none",
    cureStatuses: values.cureStatuses || [],
    element: values.element || "none",
    catalogGroup: values.catalogGroup || type,
    desc: values.desc || ""
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
  armor("海王の指輪", 0, { effect: "mp_gain_on_damage", effectPower: 2 }),
  armor("金星の指輪", 0, { effect: "steal_gold_on_damage" }),
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
  magic("＜音色＞", 2, { effect: "cure_status", statusEffect: "cold", cureStatuses: ["cold", "fever", "fog", "flash"], target: "self" }),
  magic("＜歌声＞", 5, { effect: "cure_status", statusEffect: "all", target: "self" }),
  magic("＜オーラ＞", 6, { effect: "double_attack", target: "self" }),
  magic("＜蜃気楼＞", 5, { effect: "sure_all_attack", target: "self" }),
  magic("＜乱気流＞", 5, { effect: "reflect_magic", target: "self" }),
  magic("＜壁＞", 6, { effect: "nullify_magic", target: "self" }),
  magic("＜泉＞", 7, { heal: 10, effectPower: 10, effect: "heal_hp", target: "self" }),
  magic("＜財宝＞", 5, { effectPower: 10, effect: "gold_gain", target: "self" }),
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
  item("両替", { effect: "exchange", target: "self" }),
  item("売る", { effect: "sell", target: "enemy" }),
  item("買う", { effect: "buy", target: "enemy" }),
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

const OASIS_PRICE_OVERRIDES = {
  "銅のこん棒": 1, "銀のこん棒": 10, "金のこん棒": 25, "ムチ": 1, "セイバーロッド": 10,
  "パンチ": 1, "のこぶんぶん": 10, "ハチェット": 2, "とげベルト": 3, "鎖ガマ": 2,
  "打撃の鉄板": 3, "乱弾武剣": 10, "硬いつち": 2, "エルボーサック": 3, "なぎなたクラシック": 3,
  "ゴーストソード": 10, "ファイナル牙": 3, "地獄のハサミ": 15, "パワーハルベルト": 3,
  "疾風剣": 10, "ワンダーソード": 4, "いんちきスピア": 10, "ソードシールド": 15,
  "反射剣": 5, "月光のオノ": 10, "グラビティメイス": 4, "エンゼルナイフ": 15,
  "六角凶": 15, "もろぶっこみアクス": 4, "リアルゴーストソード": 15, "精霊の杖": 20,
  "絶景のヤリ": 5, "激烈疾風剣": 15, "伝説の剣のさや": 3, "エンゼルソード": 15,
  "暴れフレイル": 5, "邪神の大剣": 1, "ドラゴンクロウ": 5, "エンゼルアクス": 15,
  "神の剣": 30, "マジカルステッキ": 10, "たいまつ": 1, "あちちナイフ": 2,
  "燃えムチ": 3, "ほむら巻き": 8, "ブレイズブレイド": 5, "火竜一角": 10,
  "つらら": 1, "霧鉄砲": 10, "氷結ハンマー": 4, "水竜一角": 10, "木刀": 1,
  "いばらのムチ": 2, "いがナッツ": 3, "夢の木づち": 15, "風のカギ爪": 10,
  "つるぎ焼き": 2, "ダイヤモンドソード": 25, "フラッシュダガー": 15, "スタースタッフ": 3,
  "ジャスティスランス": 5, "聖剣": 15, "あぶないキネ": 5, "ちくりんちょ": 10,
  "コブラ": 10, "さよならの剣": 10, "キラーフォーク": 10, "死神のカマ": 20,
  "吹き矢": 1, "クロスボウ": 2, "ブーメラン": 3, "バトルボール": 4, "戦士の弓": 5,
  "ジェットヨーヨー": 6, "未知の羽根": 7, "サイキックカード": 8, "スカイハープーン": 5,
  "恐怖の車輪": 10, "独楽コンバット": 10, "エンゼルの弓": 15, "発火のワンド": 15,
  "ファイヤークロスボウ": 8, "魔水のワンド": 15, "葉っぱ手裏剣": 3, "熟成ゴムの弓": 6,
  "旧石器ジャベリン": 4, "新石器トマホーク": 10, "輝きのカケラ": 10, "冥矢": 15,
  "革の帽子": 1, "スカイブーツ": 5, "革の服": 2, "アイアンガントレット": 3,
  "鬼のくつ": 10, "スカイガントレット": 5, "アイアンシールド": 4, "アイアンアーマー": 5,
  "鬼の小手": 15, "スカイヘルム": 5, "はがねの小手": 6, "精霊の足袋": 20,
  "はがねのかぶと": 7, "鬼のかぶと": 15, "スカイシールド": 5, "はがねの盾": 8,
  "美しいガラス細工": 20, "月光のかぶと": 10, "はがねのよろい": 9, "鬼のよろい": 20,
  "精霊の頭巾": 20, "スカイアーマー": 5, "エンゼルの小手": 15, "エナジーヘルム": 10,
  "月光の盾": 10, "エナジーアーマー": 10, "エンゼルの帽子": 15, "コアバリヤー": 10,
  "精霊の帯": 20, "月光のよろい": 10, "コアプロテクター": 10, "エンゼルシールド": 15,
  "エンゼルアーマー": 15, "神の盾": 30, "火花の小手": 4, "フレイムブーツ": 6,
  "フレイムメット": 8, "フレイムシールド": 10, "フレイムアーマー": 10,
  "バーニングシールド": 10, "バーニングジャケット": 10, "熱狂仮面": 10,
  "陽炎のよろい": 15, "アクアシューズ": 2, "アクアグローブ": 4, "アイスブーツ": 6,
  "アイスヘルム": 8, "アイスシールド": 10, "アイスアーマー": 10, "スノーミトン": 10,
  "スノーマスク": 10, "草かんむり": 2, "木の盾": 4, "御神木の小手": 6, "林の盾": 8,
  "樹脂で編んだ法衣": 10, "森の盾": 10, "コハクの胸当て": 10, "夢見る帽子": 15,
  "石版": 2, "岩盤": 4, "結晶板": 6, "大地のくつ": 8, "大地の小手": 10,
  "大地のかぶと": 10, "大地のよろい": 10, "ぴかぴかハイヒール": 15, "きらきらドレス": 15,
  "火星の指輪": 10, "水星の指輪": 10, "木星の指輪": 10, "土星の指輪": 10,
  "天王の指輪": 10, "冥王の指輪": 10, "海王の指輪": 10, "金星の指輪": 10,
  "虹のカーテン": 15, "スーパーミラー": 10,
  "スマイルのしずく": 1, "ハートのしずく": 3, "ロマンスウォーター": 5,
  "天の川のおいしい水": 20, "スマイルの花": 1, "ハートの花": 3, "ロマンスの香木": 5,
  "天国草": 20, "スマイルの貝がら": 5, "ハートの貝がら": 15, "守護封印のつぼ": 10,
  "ドキドキ涙": 1, "ちからの粉": 15, "精霊のぬいぐるみ": 5, "夜空のホウキ": 10,
  "女神の石けん": 10, "運命のひも": 3, "太陽のお守り": 10, "あぶないウス": 1,
  "両替": 5, "売る": 5, "買う": 5
};

const OASIS_RATE_OVERRIDES = {
  "銅のこん棒": 0.6, "ムチ": 0.8, "パンチ": 1, "ハチェット": 1.2, "鎖ガマ": 1.4,
  "乱弾武剣": 1.4, "硬いつち": 1.6, "なぎなたクラシック": 1.6, "ファイナル牙": 1.6,
  "パワーハルベルト": 1.4, "ワンダーソード": 1.4, "反射剣": 0.6, "グラビティメイス": 0.8,
  "もろぶっこみアクス": 0.8, "絶景のヤリ": 0.8, "暴れフレイル": 0.6, "ドラゴンクロウ": 0.6,
  "革の帽子": 2, "革の服": 2, "アイアンガントレット": 1.6, "アイアンシールド": 1.6,
  "アイアンアーマー": 1.6, "はがねの小手": 1.2, "はがねのかぶと": 1.2, "はがねの盾": 1.2,
  "はがねのよろい": 1.2, "エナジーヘルム": 0.8, "エナジーアーマー": 0.8,
  "コアバリヤー": 0.4, "コアプロテクター": 0.4, "虹のカーテン": 0.6,
  "スマイルのしずく": 2.4, "ハートのしずく": 1.6, "ロマンスウォーター": 0.8,
  "スマイルの花": 2.4, "ハートの花": 1.6, "ロマンスの香木": 0.8,
  "スマイルの貝がら": 2.4, "ハートの貝がら": 1.2, "守護封印のつぼ": 0.6,
  "ドキドキ涙": 0.4, "ちからの粉": 0.4, "精霊のぬいぐるみ": 0.4,
  "両替": 4, "売る": 4, "買う": 4,
  "小悪魔": 0, "中悪魔": 0, "大悪魔": 0, "イタズラマン": 0, "めぐみの妖精": 0
};

const OASIS_SPECIAL_DESCRIPTIONS = {
  "乱弾武剣": "攻撃5。無属性の攻撃を弾き、全プレイヤーからランダムな1人へ返す。",
  "反射剣": "攻撃10。無属性攻撃を攻撃者へはね返す。",
  "月光のオノ": "攻撃10。奇跡を攻撃者へはね返す。",
  "エンゼルナイフ": "攻撃11。奇跡を完全に止める。",
  "精霊の杖": "攻撃12。このカードと同時に使う奇跡のMP消費を0にする。",
  "エンゼルソード": "攻撃13。奇跡を完全に止める。",
  "邪神の大剣": "攻撃14。与えたダメージと同じダメージを使用者も受ける。",
  "エンゼルアクス": "攻撃15。奇跡を完全に止める。",
  "マジカルステッキ": "全MPを消費し、消費したMP×2の攻撃を行う。",
  "あぶないキネ": "攻撃30。攻撃先は自分を含めてランダム。あぶないウス所持者がいる場合、その所持者に99ダメージ。",
  "スカイハープーン": "追加攻撃+9。奇跡を弾く。",
  "エンゼルの弓": "追加攻撃+15。奇跡を完全に止める。",
  "発火のワンド": "追加攻撃+2。攻撃全体を火属性に変える。",
  "魔水のワンド": "追加攻撃+5。攻撃全体を水属性に変える。",
  "昇天弓": "命中率25%の全体攻撃1。昇天時は自動発動し、命中率75%・攻撃30になる。",
  "シャドウハンド": "命中率50%の全体攻撃2。1ダメージ以上与えた相手を即死させる。",
  "熱狂仮面": "防御10。使用者に熱病を与える。",
  "夢見る帽子": "防御14。使用者に夢を与え、所持カードをすべて引き直す。",
  "火星の指輪": "1以上のダメージを受けた時、命中率75%で敵全体へ受けたダメージと同じ攻撃。",
  "水星の指輪": "1以上のダメージを受けた時、攻撃者に霧を与える。",
  "木星の指輪": "1以上のダメージを受けた時、攻撃者に夢を与える。",
  "土星の指輪": "1以上のダメージを受けた時、攻撃者へ受けたダメージ×2の攻撃。",
  "天王の指輪": "1以上のダメージを受けた時、攻撃者に閃光を与える。",
  "冥王の指輪": "1以上のダメージを受けた時、攻撃者に暗雲を与える。",
  "海王の指輪": "1以上のダメージを受けた時、自分のMPを受けたダメージ×2回復。",
  "金星の指輪": "1以上のダメージを受けた時、攻撃者から受けたダメージと同額のゴールドを没収。",
  "虹のカーテン": "受ける攻撃の属性を無属性に変える。",
  "スーパーミラー": "受けた攻撃を種類や属性に関係なく攻撃者へはね返す。",
  "＜オーラ＞": "MP6。単体武器の攻撃力を2倍にする。",
  "＜蜃気楼＞": "MP5。次に使う単体武器を必中の全体攻撃にする。",
  "＜乱気流＞": "MP5。奇跡を弾く。",
  "＜壁＞": "MP6。無属性武器を完全に止める。",
  "＜財宝＞": "MP5。対象のゴールドを10増やす。",
  "＜解放＞": "MP15。守護神をランダムに1体呼び出す。",
  "夜空のホウキ": "対象の手札から無作為に選ばれたカードを3枚消す。",
  "女神の石けん": "対象が習得した奇跡から無作為に2つ忘れさせる。",
  "運命のひも": "ランダムな超常現象を発生させる。",
  "太陽のお守り": "所持者のHPが0になった時、自動でHP10まで復活する。",
  "天国草": "対象のMPを20回復し、天国病を与える。",
  "あぶないウス": "あぶないキネの効果発動時に99ダメージ。捨てても手元に戻り、1ダメージを受ける。",
  "両替": "自分のHP・MP・ゴールドの合計値を、好きな配分に振り分ける。HP1＝MP1＝￥1。",
  "売る": "自分の手札を1枚選び、価格分のゴールドを持つ相手へ売る。支払い後にカードを相手へ渡す。",
  "買う": "相手の手札を無作為に1枚提示し、価格分のゴールドがあれば購入するか選べる。",
  "イタズラマン": "使用者の手札または起こした奇跡から無作為に2つ消す。",
  "めぐみの妖精": "使用者のHP・MP・ゴールドのいずれかをランダムに10増やす。"
};

function catalogDescription(card) {
  if (OASIS_SPECIAL_DESCRIPTIONS[card.sourceName]) return OASIS_SPECIAL_DESCRIPTIONS[card.sourceName];

  const chance = Number(card.effectChance ?? 100);
  const chanceText = chance < 100 ? `命中率${chance}%の` : "";
  if (card.type === "weapon") {
    const attackText = card.catalogGroup === "additional_weapon"
      ? `追加攻撃+${card.attack}`
      : `${chanceText}${card.isAllAttack ? "全体攻撃" : "攻撃"}${card.attack}`;
    if (card.effect === "multi_hit") return `攻撃${card.attack}を${card.hitCount || 2}回行う。`;
    if (card.effect === "hp_drain") return `${attackText}。与えたダメージ分だけHPを回復する。`;
    if (card.effect === "inflict_status") return `${attackText}。1ダメージ以上与えた時、対象に${STATUS_EFFECTS[card.statusEffect] || "災い"}を与える。`;
    if (card.statusEffect && card.statusEffect !== "none") return `${attackText}。1ダメージ以上与えた時、対象に${STATUS_EFFECTS[card.statusEffect] || "災い"}を与える。`;
    return `${attackText}${card.defense ? `、防御${card.defense}` : ""}。`;
  }
  if (card.type === "enchant") {
    const attackText = card.attack ? `、追加攻撃+${card.attack}` : "";
    return `防御${card.defense}${attackText}。`;
  }
  if (card.type === "magic") {
    if (["magic_attack", "magic_all_attack", "hp_drain"].includes(card.effect)) {
      const base = `MP${card.mpCost}。${chanceText}${card.effect === "magic_all_attack" ? "全体攻撃" : "攻撃"}${card.attack || card.effectPower}`;
      return `${base}${card.effect === "hp_drain" ? "。与えたダメージ分だけHPを回復する。" : "。"}`
    }
    if (card.effect === "inflict_status") {
      const attack = card.attack ? `${chanceText}攻撃${card.attack}。命中した時、` : "";
      return `MP${card.mpCost}。${attack}対象に${STATUS_EFFECTS[card.statusEffect] || "災い"}を与える。`;
    }
    if (card.effect === "cure_status") return `MP${card.mpCost}。${card.statusEffect === "all" ? "すべての災い" : "指定された災い"}を消す。`;
    if (card.effect === "heal_hp") return `MP${card.mpCost}。対象のHPを${card.effectPower || card.heal}回復する。`;
    return `MP${card.mpCost}。${cardEffectLabel(card.type, card.effect)}。`;
  }
  if (card.effect === "heal_hp") return `対象のHPを${card.effectPower || card.heal}回復する。`;
  if (card.effect === "heal_mp") return `対象のMPを${card.effectPower}回復する。`;
  if (card.effect === "cure_status") return `${card.statusEffect === "all" ? "すべての災い" : "風邪・熱病・霧・閃光"}を消す。`;
  if (card.effect === "random_heal_damage") return "対象のHPを10回復するか、10ダメージを与える。確率は50%ずつ。";
  if (card.effect === "summon_guardian") return "対象に守護神をランダムに1体宿す。";
  if (card.effect === "boost_attack") return `対象の次の攻撃を+${card.effectPower}する。`;
  if (card.effect === "mp_free_magic") return "対象が次に使う奇跡のMP消費を0にする。";
  if (card.effect === "self_damage") return `使用者に${card.effectPower}ダメージを与える。`;
  return `${cardEffectLabel(card.type, card.effect)}。`;
}

OASIS_CATALOG_CARDS.forEach(card => {
  const fallbackPrice = ["小悪魔", "中悪魔", "大悪魔", "イタズラマン", "めぐみの妖精"].includes(card.sourceName)
    ? 0
    : Math.max(1, Math.min(30, card.type === "magic"
      ? card.mpCost || 1
      : Math.ceil(Math.max(card.attack || 0, card.defense || 0, card.effectPower || 0, 1) / 2)));
  card.price = OASIS_PRICE_OVERRIDES[card.sourceName] ?? (card.price > 0 ? card.price : fallbackPrice);
  card.drawRate = OASIS_RATE_OVERRIDES[card.sourceName] ?? card.drawRate ?? 0.2;
  card.desc = card.desc || catalogDescription(card);
});

const OASIS_CATALOG_COUNTS = OASIS_CATALOG_CARDS.reduce((counts, card) => {
  counts[card.catalogGroup] = (counts[card.catalogGroup] || 0) + 1;
  return counts;
}, {});

if (typeof window !== "undefined") {
  window.OASIS_CATALOG_CARDS = OASIS_CATALOG_CARDS;
  window.OASIS_CATALOG_COUNTS = OASIS_CATALOG_COUNTS;
}
