import { ProductCategory } from './storage';

export interface MasterProduct {
  id: string;
  name: string;
  image: string;
  unit: string;
  defaultDescription: string;
  category: ProductCategory;
}

export const MASTER_PRODUCTS: MasterProduct[] = [
  // VEGETABLES
  { id: 'v001', name: 'Tomato', image: 'https://images.unsplash.com/photo-1582284540020-8acbe03f4924?w=400', unit: '1 kg', defaultDescription: 'Fresh red tomatoes, handpicked daily', category: 'vegetables' },
  { id: 'v002', name: 'Onion', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=400', unit: '1 kg', defaultDescription: 'Premium quality onions', category: 'vegetables' },
  { id: 'v003', name: 'Potato', image: 'https://images.unsplash.com/photo-1596910547037-846b1980329f?w=400', unit: '1 kg', defaultDescription: 'Farm fresh potatoes', category: 'vegetables' },
  { id: 'v004', name: 'Carrot', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=400', unit: '500 g', defaultDescription: 'Crunchy orange carrots, rich in vitamins', category: 'vegetables' },
  { id: 'v005', name: 'Green Chilli', image: 'https://images.unsplash.com/photo-1583119022894-919a68a3d0e3?w=400', unit: '250 g', defaultDescription: 'Spicy fresh green chillies', category: 'vegetables' },
  { id: 'v006', name: 'Capsicum', image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=400', unit: '500 g', defaultDescription: 'Colorful bell peppers', category: 'vegetables' },
  { id: 'v007', name: 'Spinach', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=400', unit: '1 bundle', defaultDescription: 'Fresh green spinach leaves', category: 'vegetables' },
  { id: 'v008', name: 'Cabbage', image: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=400', unit: '1 pc', defaultDescription: 'Fresh whole cabbage head', category: 'vegetables' },
  { id: 'v009', name: 'Cauliflower', image: 'https://images.unsplash.com/photo-1613743983303-b3e89f8a2b80?w=400', unit: '1 pc', defaultDescription: 'Fresh white cauliflower', category: 'vegetables' },
  { id: 'v010', name: 'Brinjal', image: 'https://images.unsplash.com/photo-1604321272882-07c73743be32?w=400', unit: '500 g', defaultDescription: 'Fresh purple brinjal (eggplant)', category: 'vegetables' },
  { id: 'v011', name: 'Cucumber', image: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=400', unit: '500 g', defaultDescription: 'Cool fresh cucumbers', category: 'vegetables' },
  { id: 'v012', name: 'Bitter Gourd', image: 'https://images.unsplash.com/photo-1676994174279-102e0abff98f?w=400', unit: '500 g', defaultDescription: 'Fresh bitter gourd (karela)', category: 'vegetables' },
  { id: 'v013', name: 'Lady Finger', image: 'https://images.unsplash.com/photo-1617692855027-33b14f061079?w=400', unit: '250 g', defaultDescription: 'Tender okra pods', category: 'vegetables' },
  { id: 'v014', name: 'Peas', image: 'https://images.unsplash.com/photo-1560705185-d0291220a442?w=400', unit: '500 g', defaultDescription: 'Fresh green peas', category: 'vegetables' },
  { id: 'v015', name: 'Garlic', image: 'https://images.unsplash.com/photo-1587049633312-d628ae50a8ae?w=400', unit: '250 g', defaultDescription: 'Fresh garlic bulbs', category: 'vegetables' },
  { id: 'v016', name: 'Ginger', image: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400', unit: '250 g', defaultDescription: 'Fresh ginger root', category: 'vegetables' },
  { id: 'v017', name: 'Coriander', image: 'https://images.unsplash.com/photo-1644709438449-3d9b34793988?w=400', unit: '1 bundle', defaultDescription: 'Fresh coriander (dhania) leaves', category: 'vegetables' },
  { id: 'v018', name: 'Mint Leaves', image: 'https://images.unsplash.com/photo-1618130070080-91f4d55a2383?w=400', unit: '1 bundle', defaultDescription: 'Aromatic fresh mint leaves', category: 'vegetables' },
  { id: 'v019', name: 'Sweet Corn', image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400', unit: '1 pc', defaultDescription: 'Sweet fresh corn cobs', category: 'vegetables' },
  { id: 'v020', name: 'Lemon', image: 'https://images.unsplash.com/photo-1582287104445-6754664dbdb2?w=400', unit: '6 pcs', defaultDescription: 'Fresh juicy lemons', category: 'vegetables' },
  { id: 'v021', name: 'Drumstick', image: 'https://images.unsplash.com/photo-1617780494293-e8ff9a48d833?w=400', unit: '1 bundle', defaultDescription: 'Fresh drumstick (moringa) pods', category: 'vegetables' },
  { id: 'v022', name: 'Bottle Gourd', image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=400', unit: '1 pc', defaultDescription: 'Fresh bottle gourd (lauki)', category: 'vegetables' },
  { id: 'v023', name: 'Ridge Gourd', image: 'https://images.unsplash.com/photo-1762176189281-05ac6090efdd?w=400', unit: '500 g', defaultDescription: 'Fresh ridge gourd (turai)', category: 'vegetables' },

  // GROCERIES
  { id: 'g001', name: 'Rice (Basmati)', image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400', unit: '1 packet', defaultDescription: 'Premium long-grain basmati rice, 5 kg', category: 'groceries' },
  { id: 'g002', name: 'Rice (Regular)', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=400', unit: '1 packet', defaultDescription: 'Regular cooking rice, 5 kg', category: 'groceries' },
  { id: 'g003', name: 'Sugar', image: 'https://images.unsplash.com/photo-1619451334792-150fd785ee74?w=400', unit: '1 packet', defaultDescription: 'Pure white refined sugar, 1 kg', category: 'groceries' },
  { id: 'g004', name: 'Salt', image: 'https://images.unsplash.com/photo-1527515862127-a4fc05baf7a5?w=400', unit: '1 packet', defaultDescription: 'Iodized table salt, 1 kg', category: 'groceries' },
  { id: 'g005', name: 'Cooking Oil (Sunflower)', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=400', unit: '1 bottle', defaultDescription: 'Pure sunflower cooking oil, 1 L', category: 'groceries' },
  { id: 'g006', name: 'Mustard Oil', image: 'https://images.unsplash.com/photo-1620706857370-e1b9770e8bb1?w=400', unit: '1 bottle', defaultDescription: 'Pure cold-pressed mustard oil, 1 L', category: 'groceries' },
  { id: 'g007', name: 'Wheat Flour (Atta)', image: 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=400', unit: '1 packet', defaultDescription: 'Whole wheat flour for rotis, 5 kg', category: 'groceries' },
  { id: 'g008', name: 'Toor Dal', image: 'https://images.unsplash.com/photo-1633857462464-013f740de54b?w=400', unit: '1 packet', defaultDescription: 'Split pigeon peas (toor dal), 1 kg', category: 'groceries' },
  { id: 'g009', name: 'Moong Dal', image: 'https://images.unsplash.com/photo-1604542031658-5799ca5d7936?w=400', unit: '1 packet', defaultDescription: 'Split green gram (moong dal), 1 kg', category: 'groceries' },
  { id: 'g010', name: 'Tea (CTC)', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400', unit: '1 packet', defaultDescription: 'Strong CTC tea leaves, 500 g', category: 'groceries' },
  { id: 'g011', name: 'Coffee Powder', image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400', unit: '1 packet', defaultDescription: 'Ground coffee powder, 200 g', category: 'groceries' },
  { id: 'g012', name: 'Bathing Soap', image: 'https://images.unsplash.com/photo-1600857062241-98e5dba7f214?w=400', unit: '1 pack', defaultDescription: 'Fragrant bathing soap bars, 3 pcs', category: 'groceries' },
  { id: 'g013', name: 'Washing Powder', image: 'https://images.unsplash.com/photo-1624372635282-b324bcdd4907?w=400', unit: '1 packet', defaultDescription: 'Laundry washing powder, 1 kg', category: 'groceries' },
  { id: 'g014', name: 'Dishwash Bar', image: 'https://images.unsplash.com/photo-1567110684145-43024ecf0fa7?w=400', unit: '1 pack', defaultDescription: 'Dish washing bar soap, 2 pcs', category: 'groceries' },
  { id: 'g015', name: 'Toothpaste', image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400', unit: '1 tube', defaultDescription: 'Fluoride toothpaste for strong teeth, 150 g', category: 'groceries' },
  { id: 'g016', name: 'Shampoo', image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=400', unit: '1 bottle', defaultDescription: 'Hair care shampoo, 200 ml', category: 'groceries' },
  { id: 'g017', name: 'Chana Dal', image: 'https://images.unsplash.com/photo-1626933176453-85751fb4a825?w=400', unit: '1 packet', defaultDescription: 'Split chickpeas (chana dal), 1 kg', category: 'groceries' },
  { id: 'g018', name: 'Mustard Seeds', image: 'https://images.unsplash.com/photo-1701188542905-01e99a1b8177?w=400', unit: '1 packet', defaultDescription: 'Black mustard seeds for tempering, 100 g', category: 'groceries' },
  { id: 'g019', name: 'Turmeric Powder', image: 'https://images.unsplash.com/photo-1504387828636-abeb50778c0c?w=400', unit: '1 packet', defaultDescription: 'Pure turmeric (haldi) powder, 100 g', category: 'groceries' },
  { id: 'g020', name: 'Red Chilli Powder', image: 'https://images.unsplash.com/photo-1526346698789-22fd84314424?w=400', unit: '1 packet', defaultDescription: 'Hot red chilli powder, 100 g', category: 'groceries' },
  { id: 'g021', name: 'Coconut Oil', image: 'https://images.unsplash.com/photo-1596663097529-c65b32a1f506?w=400', unit: '1 bottle', defaultDescription: 'Pure cold-pressed coconut oil, 500 ml', category: 'groceries' },
  { id: 'g022', name: 'Biscuits (Cream)', image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400', unit: '1 pack', defaultDescription: 'Cream-filled biscuit pack', category: 'groceries' },
  { id: 'g023', name: 'Cumin Seeds', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400', unit: '1 packet', defaultDescription: 'Whole cumin (jeera) seeds for cooking, 100 g', category: 'groceries' },

  // STATIONERY
  { id: 's001', name: 'A4 Notebook', image: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=400', unit: '1 pc', defaultDescription: 'Ruled A4 notebook, 200 pages', category: 'stationery' },
  { id: 's002', name: 'Ballpoint Pen', image: 'https://images.unsplash.com/photo-1585336261022-680e295ce3fe?w=400', unit: '1 pack', defaultDescription: 'Blue ballpoint pens, 10 pcs', category: 'stationery' },
  { id: 's003', name: 'Pencil HB', image: 'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=400', unit: '1 pack', defaultDescription: 'HB writing pencils, 12 pcs', category: 'stationery' },
  { id: 's004', name: 'Eraser', image: 'https://images.unsplash.com/photo-1627186131254-702e182adb80?w=400', unit: '1 pack', defaultDescription: 'Clean non-dust erasers, 5 pcs', category: 'stationery' },
  { id: 's005', name: 'Ruler 30cm', image: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400', unit: '1 pc', defaultDescription: 'Transparent plastic ruler', category: 'stationery' },
  { id: 's006', name: 'Geometry Box', image: 'https://images.unsplash.com/photo-1591815302525-756a9bcc3425?w=400', unit: '1 box', defaultDescription: 'Complete geometry instrument set', category: 'stationery' },
  { id: 's007', name: 'Stapler', image: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400', unit: '1 pc', defaultDescription: 'Desktop stapler with staples', category: 'stationery' },
  { id: 's008', name: 'Sticky Notes', image: 'https://images.unsplash.com/photo-1620325867502-221cfb5faa5f?w=400', unit: '1 pack', defaultDescription: 'Colorful sticky notes, 400 sheets', category: 'stationery' },
  { id: 's009', name: 'Scissors', image: 'https://images.unsplash.com/photo-1588515724527-074a7a56616c?w=400', unit: '1 pc', defaultDescription: 'Sharp stainless steel scissors', category: 'stationery' },
  { id: 's010', name: 'Tape (Cello)', image: 'https://images.unsplash.com/photo-1511285547760-79b561563b35?w=400', unit: '1 pack', defaultDescription: 'Clear adhesive tape, 2 rolls', category: 'stationery' },
  { id: 's011', name: 'Colored Pencils', image: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=400', unit: '1 box', defaultDescription: '24-shade colored pencil box', category: 'stationery' },
  { id: 's012', name: 'Highlighter Set', image: 'https://images.unsplash.com/photo-1586764635350-4f88a6a30a52?w=400', unit: '1 pack', defaultDescription: 'Fluorescent highlighter pens, 5 pcs', category: 'stationery' },
  { id: 's013', name: 'Glue Stick', image: 'https://images.unsplash.com/photo-1536786724684-63545518d243?w=400', unit: '1 pack', defaultDescription: 'Non-toxic glue sticks, 3 pcs', category: 'stationery' },
  { id: 's014', name: 'Marker Set', image: 'https://images.unsplash.com/photo-1704136815765-e61f01f6df85?w=400', unit: '1 pack', defaultDescription: 'Permanent marker set, 10 pcs', category: 'stationery' },
  { id: 's015', name: 'Drawing Book A3', image: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400', unit: '1 pc', defaultDescription: 'Blank A3 drawing book, 40 pages', category: 'stationery' },
  { id: 's016', name: 'File Folder', image: 'https://images.unsplash.com/photo-1586187543706-b43086b30978?w=400', unit: '1 pack', defaultDescription: 'Plastic file folders, 5 pcs', category: 'stationery' },
  { id: 's017', name: 'Index Cards', image: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400', unit: '1 pack', defaultDescription: 'Blank white index cards, 100 pcs', category: 'stationery' },
];

export const CATEGORIES: { id: ProductCategory; label: string; icon: string; color: string }[] = [
  { id: 'vegetables', label: 'Vegetables', icon: 'leaf', color: '#2E7D32' },
  { id: 'groceries', label: 'Groceries', icon: 'basket', color: '#E65100' },
  { id: 'stationery', label: 'Stationery', icon: 'pencil', color: '#1565C0' },
];

export function getMasterProductsByCategory(category: ProductCategory): MasterProduct[] {
  return MASTER_PRODUCTS.filter(p => p.category === category);
}
