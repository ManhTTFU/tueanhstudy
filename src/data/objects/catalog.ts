/**
 * Thư viện hình minh họa cho chương "Bé tập đếm".
 * Ảnh: public/assets/images/objects/<id>.svg
 * Nguồn: Microsoft Fluent Emoji (MIT) – tải bằng `npm run assets:images`.
 *
 * Thêm hình mới: thêm 1 dòng vào OBJECTS (id duy nhất, `source` là tên thư mục
 * trong repo fluentui-emoji), chạy `npm run assets:images` và `npm run assets:voice`.
 */
export type ObjectCategory = 'animal' | 'plant' | 'flower' | 'fruit' | 'thing';

export interface CountableObject {
  id: string;
  /** Danh từ kèm loại từ, dùng trong câu hỏi: "Có bao nhiêu chú thỏ?" */
  label: string;
  category: ObjectCategory;
  source: string;
}

export const CATEGORY_NAMES: Record<ObjectCategory, string> = {
  animal: 'Động vật',
  plant: 'Cây cối',
  flower: 'Hoa',
  fruit: 'Trái cây & rau củ',
  thing: 'Đồ vật',
};

const o = (id: string, label: string, category: ObjectCategory, source: string): CountableObject => ({
  id,
  label,
  category,
  source,
});

export const OBJECTS: readonly CountableObject[] = [
  // ---------- Động vật (40) ----------
  o('cat', 'chú mèo', 'animal', 'Cat'),
  o('dog', 'chú chó', 'animal', 'Dog'),
  o('rabbit', 'chú thỏ', 'animal', 'Rabbit'),
  o('duck', 'chú vịt', 'animal', 'Duck'),
  o('chicken', 'chú gà', 'animal', 'Chicken'),
  o('elephant', 'chú voi', 'animal', 'Elephant'),
  o('lion', 'chú sư tử', 'animal', 'Lion'),
  o('monkey', 'chú khỉ', 'animal', 'Monkey'),
  o('fish', 'chú cá', 'animal', 'Tropical fish'),
  o('butterfly', 'chú bướm', 'animal', 'Butterfly'),
  o('bear', 'chú gấu', 'animal', 'Bear'),
  o('deer', 'chú hươu', 'animal', 'Deer'),
  o('horse', 'chú ngựa', 'animal', 'Horse'),
  o('bird', 'chú chim', 'animal', 'Bird'),
  o('turtle', 'chú rùa', 'animal', 'Turtle'),
  o('panda', 'chú gấu trúc', 'animal', 'Panda'),
  o('koala', 'chú gấu koala', 'animal', 'Koala'),
  o('penguin', 'chú chim cánh cụt', 'animal', 'Penguin'),
  o('pig', 'chú heo', 'animal', 'Pig'),
  o('cow', 'chú bò', 'animal', 'Cow'),
  o('frog', 'chú ếch', 'animal', 'Frog'),
  o('giraffe', 'chú hươu cao cổ', 'animal', 'Giraffe'),
  o('zebra', 'chú ngựa vằn', 'animal', 'Zebra'),
  o('owl', 'chú cú mèo', 'animal', 'Owl'),
  o('whale', 'chú cá voi', 'animal', 'Spouting whale'),
  o('octopus', 'chú bạch tuộc', 'animal', 'Octopus'),
  o('crab', 'chú cua', 'animal', 'Crab'),
  o('snail', 'chú ốc sên', 'animal', 'Snail'),
  o('ladybug', 'chú bọ rùa', 'animal', 'Lady beetle'),
  o('bee', 'chú ong', 'animal', 'Honeybee'),
  o('hedgehog', 'chú nhím', 'animal', 'Hedgehog'),
  o('mouse', 'chú chuột', 'animal', 'Mouse'),
  o('tiger', 'chú hổ', 'animal', 'Tiger'),
  o('fox', 'chú cáo', 'animal', 'Fox'),
  o('chick', 'chú gà con', 'animal', 'Baby chick'),
  o('flamingo', 'chú hồng hạc', 'animal', 'Flamingo'),
  o('parrot', 'chú vẹt', 'animal', 'Parrot'),
  o('sheep', 'chú cừu', 'animal', 'Ewe'),
  o('seal', 'chú hải cẩu', 'animal', 'Seal'),
  o('dinosaur', 'chú khủng long', 'animal', 'Sauropod'),

  // ---------- Cây cối (11) ----------
  o('tree', 'cây xanh', 'plant', 'Deciduous tree'),
  o('leaf', 'chiếc lá', 'plant', 'Leaf fluttering in wind'),
  o('maple-leaf', 'chiếc lá phong', 'plant', 'Maple leaf'),
  o('fallen-leaf', 'chiếc lá vàng', 'plant', 'Fallen leaf'),
  o('cactus', 'cây xương rồng', 'plant', 'Cactus'),
  o('pine-tree', 'cây thông', 'plant', 'Evergreen tree'),
  o('palm-tree', 'cây dừa', 'plant', 'Palm tree'),
  o('potted-plant', 'chậu cây', 'plant', 'Potted plant'),
  o('seedling', 'mầm cây', 'plant', 'Seedling'),
  o('clover', 'cỏ bốn lá', 'plant', 'Four leaf clover'),
  o('mushroom', 'cây nấm', 'plant', 'Mushroom'),

  // ---------- Hoa (9) ----------
  o('rose', 'bông hoa hồng', 'flower', 'Rose'),
  o('tulip', 'bông hoa tulip', 'flower', 'Tulip'),
  o('daisy', 'bông hoa cúc', 'flower', 'Blossom'),
  o('lotus', 'bông hoa sen', 'flower', 'Lotus'),
  o('sunflower', 'bông hoa hướng dương', 'flower', 'Sunflower'),
  o('hibiscus', 'bông hoa dâm bụt', 'flower', 'Hibiscus'),
  o('cherry-blossom', 'bông hoa anh đào', 'flower', 'Cherry blossom'),
  o('hyacinth', 'cành hoa tím', 'flower', 'Hyacinth'),
  o('white-flower', 'bông hoa trắng', 'flower', 'White flower'),

  // ---------- Trái cây & rau củ (20) ----------
  o('apple', 'quả táo', 'fruit', 'Red apple'),
  o('green-apple', 'quả táo xanh', 'fruit', 'Green apple'),
  o('banana', 'quả chuối', 'fruit', 'Banana'),
  o('orange', 'quả cam', 'fruit', 'Tangerine'),
  o('strawberry', 'quả dâu tây', 'fruit', 'Strawberry'),
  o('watermelon', 'miếng dưa hấu', 'fruit', 'Watermelon'),
  o('grapes', 'chùm nho', 'fruit', 'Grapes'),
  o('mango', 'quả xoài', 'fruit', 'Mango'),
  o('pear', 'quả lê', 'fruit', 'Pear'),
  o('peach', 'quả đào', 'fruit', 'Peach'),
  o('cherries', 'chùm cherry', 'fruit', 'Cherries'),
  o('pineapple', 'quả dứa', 'fruit', 'Pineapple'),
  o('lemon', 'quả chanh', 'fruit', 'Lemon'),
  o('coconut', 'quả dừa', 'fruit', 'Coconut'),
  o('kiwi', 'quả kiwi', 'fruit', 'Kiwi fruit'),
  o('melon', 'quả dưa lưới', 'fruit', 'Melon'),
  o('carrot', 'củ cà rốt', 'fruit', 'Carrot'),
  o('tomato', 'quả cà chua', 'fruit', 'Tomato'),
  o('corn', 'bắp ngô', 'fruit', 'Ear of corn'),
  o('eggplant', 'quả cà tím', 'fruit', 'Eggplant'),

  // ---------- Đồ vật (20) ----------
  o('car', 'chiếc ô tô', 'thing', 'Automobile'),
  o('ball', 'quả bóng', 'thing', 'Soccer ball'),
  o('star', 'ngôi sao', 'thing', 'Star'),
  o('balloon', 'quả bóng bay', 'thing', 'Balloon'),
  o('teddy-bear', 'chú gấu bông', 'thing', 'Teddy bear'),
  o('candy', 'viên kẹo', 'thing', 'Candy'),
  o('airplane', 'chiếc máy bay', 'thing', 'Airplane'),
  o('dice', 'khối xúc xắc', 'thing', 'Game die'),
  o('sailboat', 'chiếc thuyền', 'thing', 'Sailboat'),
  o('umbrella', 'chiếc ô', 'thing', 'Umbrella'),
  o('bicycle', 'chiếc xe đạp', 'thing', 'Bicycle'),
  o('bus', 'chiếc xe buýt', 'thing', 'Bus'),
  o('kite', 'con diều', 'thing', 'Kite'),
  o('drum', 'cái trống', 'thing', 'Drum'),
  o('gift', 'hộp quà', 'thing', 'Wrapped gift'),
  o('crayon', 'cây bút sáp', 'thing', 'Crayon'),
  o('backpack', 'chiếc ba lô', 'thing', 'Backpack'),
  o('lollipop', 'cây kẹo mút', 'thing', 'Lollipop'),
  o('heart', 'trái tim', 'thing', 'Red heart'),
  o('cloud', 'đám mây', 'thing', 'Cloud'),
] as const;

const byId = new Map(OBJECTS.map((x) => [x.id, x]));

export function getObject(id: string): CountableObject | undefined {
  return byId.get(id);
}

export function objectImage(id: string): string {
  return `/assets/images/objects/${id}.svg`;
}

export function objectQuestionAudio(id: string): string {
  return `/assets/sounds/questions/count-${id}.m4a`;
}
