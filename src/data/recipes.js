// 食谱库(种子数据)
//
// 基准份说明:
// - staple/protein 槽的可缩放食材(scalable: true)会被规划器按目标热量/蛋白
//   乘系数调整克数,基准份取成人一餐的常见量(干重60-80g / 生肉120-150g / 薯类200g)
// - vegetable/fruit 槽为固定份,不缩放
// - 调味料不进入食材表,写在做法里;油计入食材(对减脂热量影响显著)

// { id, name, slot, mealFit, tags, ingredients: [{foodId, grams, scalable}], steps }
import { FOODS_MAP } from './foods.js'

const RAW_RECIPES = [
  // ================= 主食(staple) =================
  {
    id: 'r_rice', name: '白米饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_rice', grams: 70, scalable: true }],
    steps: ['米淘洗后按 1:1.2 加水,电饭煲精煮模式'],
  },
  {
    id: 'r_brown_rice', name: '糙米饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_brown_rice', grams: 45, scalable: true },
      { foodId: 'f_rice', grams: 25, scalable: true },
    ],
    steps: ['糙米提前浸泡2小时', '与大米混合,1:1.3 加水煮熟'],
  },
  {
    id: 'r_mixed_grain_rice', name: '杂粮饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_brown_rice', grams: 30, scalable: true },
      { foodId: 'f_millet', grams: 20, scalable: true },
      { foodId: 'f_rice', grams: 20, scalable: true },
    ],
    steps: ['杂粮提前浸泡2小时', '混合加水煮熟'],
  },
  {
    id: 'r_quinoa_rice', name: '藜麦饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_quinoa', grams: 40, scalable: true },
      { foodId: 'f_rice', grams: 30, scalable: true },
    ],
    steps: ['藜麦淘洗去皂苷', '与大米混合,1:1.2 加水煮熟'],
  },
  {
    id: 'r_millet_porridge', name: '小米粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_millet', grams: 50, scalable: true }],
    steps: ['小米淘洗,加水约8倍', '大火烧开转小火煮25分钟'],
  },
  {
    id: 'r_oatmeal', name: '燕麦粥', slot: 'staple', mealFit: ['breakfast'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_oats', grams: 50, scalable: true }],
    steps: ['燕麦片加水或热水冲泡/煮5分钟'],
  },
  {
    id: 'r_whole_wheat_bread_slice', name: '全麦面包片', slot: 'staple', mealFit: ['breakfast'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_whole_wheat_bread', grams: 70, scalable: true }],
    steps: ['可直接吃,或烤箱180℃烤3分钟更香'],
  },
  {
    id: 'r_steamed_bun_piece', name: '馒头', slot: 'staple', mealFit: ['breakfast'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_steamed_bun', grams: 100, scalable: true }],
    steps: ['蒸锅加热5分钟'],
  },
  {
    id: 'r_steamed_sweet_potato', name: '蒸红薯', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_sweet_potato', grams: 200, scalable: true }],
    steps: ['洗净,水开后蒸20-25分钟'],
  },
  {
    id: 'r_steamed_purple_potato', name: '蒸紫薯', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_purple_potato', grams: 200, scalable: true }],
    steps: ['洗净,水开后蒸20-25分钟'],
  },
  {
    id: 'r_steamed_potato', name: '蒸土豆', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_potato', grams: 200, scalable: true }],
    steps: ['洗净对半切,水开后蒸20分钟', '可撒少许黑胡椒盐'],
  },
  {
    id: 'r_steamed_yam', name: '蒸山药', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_yam', grams: 250, scalable: true }],
    steps: ['山药去皮切段(戴手套防痒)', '水开后蒸15分钟'],
  },
  {
    id: 'r_boiled_corn', name: '水煮玉米', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_corn', grams: 200, scalable: true }],
    steps: ['带须冷水下锅,煮15-20分钟'],
  },
  {
    id: 'r_buckwheat_noodle', name: '荞麦面', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_buckwheat_noodle', grams: 70, scalable: true }],
    steps: ['水开下面煮6-8分钟', '捞出过凉水,配少量生抽葱花'],
  },
  {
    id: 'r_pasta_plain', name: '水煮意面', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_pasta', grams: 70, scalable: true }],
    steps: ['水开加盐,意面煮8-10分钟', '拌少许橄榄油黑胡椒'],
  },
  {
    id: 'r_pumpkin_steamed', name: '蒸南瓜', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_pumpkin', grams: 250, scalable: true }],
    steps: ['南瓜切块,水开后蒸15分钟'],
  },
  {
    id: 'r_black_glutinous_rice', name: '紫米饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_black_glutinous_rice', grams: 40, scalable: true },
      { foodId: 'f_rice', grams: 30, scalable: true },
    ],
    steps: ['紫米提前浸泡3小时', '与大米混合,1:1.2 加水煮熟'],
  },
  {
    id: 'r_mung_bean_porridge', name: '绿豆粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_mung_bean_dry', grams: 30, scalable: true },
      { foodId: 'f_rice', grams: 20, scalable: true },
    ],
    steps: ['绿豆提前浸泡2小时', '与大米加水煮至开花'],
  },
  {
    id: 'r_red_bean_rice', name: '红豆饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_red_bean_dry', grams: 25, scalable: true },
      { foodId: 'f_rice', grams: 40, scalable: true },
    ],
    steps: ['红豆提前浸泡4小时煮半小时', '加入大米同煮熟'],
  },
  {
    id: 'r_oat_banana_bowl', name: '燕麦香蕉碗', slot: 'staple', mealFit: ['breakfast'], tags: ['gluten'],
    ingredients: [
      { foodId: 'f_oats', grams: 40, scalable: true },
      { foodId: 'f_banana', grams: 120, scalable: false },
    ],
    steps: ['燕麦加热水或牛奶泡5分钟', '香蕉切片铺上'],
  },
  {
    id: 'r_sweet_potato_porridge', name: '红薯粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_sweet_potato', grams: 100, scalable: true },
      { foodId: 'f_rice', grams: 25, scalable: true },
    ],
    steps: ['红薯去皮切块', '与大米加水煮25分钟'],
  },
  {
    id: 'r_pumpkin_millet_porridge', name: '南瓜小米粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_pumpkin', grams: 120, scalable: true },
      { foodId: 'f_millet', grams: 40, scalable: true },
    ],
    steps: ['南瓜切块与小米同煮', '大火烧开转小火20分钟'],
  },
  {
    id: 'r_plain_noodles', name: '清水挂面', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_noodles_dry', grams: 70, scalable: true }],
    steps: ['水开下面煮4-5分钟', '加少许生抽、葱花、香油,可卧个青菜'],
  },
  {
    id: 'r_steamed_taro', name: '蒸芋头', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_taro', grams: 250, scalable: true }],
    steps: ['芋头洗净(戴手套防痒)', '水开后蒸20分钟,蘸少量白糖或酱油'],
  },
  {
    id: 'r_sorghum_rice', name: '高粱米饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_sorghum', grams: 40, scalable: true },
      { foodId: 'f_rice', grams: 30, scalable: true },
    ],
    steps: ['高粱米提前浸泡4小时', '与大米混合煮熟'],
  },
  {
    id: 'r_cornmeal_porridge', name: '玉米面糊糊', slot: 'staple', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_cornmeal', grams: 50, scalable: true }],
    steps: ['玉米面先用少量凉水调开', '倒入开水搅匀,小火煮3分钟'],
  },
  {
    id: 'r_glutinous_rice', name: '糯米饭', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_glutinous_rice', grams: 70, scalable: true }],
    steps: ['糯米浸泡2小时', '沥干上锅蒸25分钟'],
  },
  {
    id: 'r_red_bean_purple_rice', name: '红豆紫米粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_red_bean_dry', grams: 20, scalable: true },
      { foodId: 'f_black_glutinous_rice', grams: 30, scalable: true },
    ],
    steps: ['红豆、紫米提前浸泡4小时', '加水煮40分钟至软糯'],
  },
  {
    id: 'r_taro_porridge', name: '芋头粥', slot: 'staple', mealFit: ['breakfast', 'lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_taro', grams: 150, scalable: true },
      { foodId: 'f_rice', grams: 25, scalable: true },
    ],
    steps: ['芋头去皮切块', '与大米加水煮25分钟'],
  },
  {
    id: 'r_mashed_potato', name: '土豆泥', slot: 'staple', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_potato', grams: 200, scalable: true }],
    steps: ['土豆去皮切块蒸20分钟', '压成泥,加少量牛奶、盐、黑胡椒拌匀'],
  },
  {
    id: 'r_homemade_whole_wheat_bun', name: '自制全麦馒头', slot: 'staple', mealFit: ['breakfast'], tags: ['gluten'],
    ingredients: [{ foodId: 'f_whole_wheat_flour', grams: 70, scalable: true }],
    steps: ['全麦面粉加酵母温水和面,发酵1小时', '整形后冷水上锅,水开蒸15分钟'],
  },

  // ================= 蛋白 —— 早餐组 =================
  {
    id: 'r_boiled_egg', name: '水煮蛋', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }],
    steps: ['冷水下锅,水开后煮6-7分钟(溏心)或8-9分钟(全熟)'],
  },
  {
    id: 'r_steamed_egg_custard', name: '蒸蛋羹', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [
      { foodId: 'f_egg', grams: 100, scalable: true },
      { foodId: 'f_egg_white', grams: 60, scalable: true },
    ],
    steps: ['鸡蛋打散,加1.2倍温水搅匀过筛', '盖保鲜膜扎孔,水开后中小火蒸10分钟'],
  },
  {
    id: 'r_tea_egg', name: '茶叶蛋', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [{ foodId: 'f_egg', grams: 100, scalable: true }],
    steps: ['鸡蛋煮熟轻敲裂纹', '加红茶、生抽、八角煮20分钟,泡一夜更入味'],
  },
  {
    id: 'r_milk_cup', name: '牛奶一杯', slot: 'protein', mealFit: ['breakfast'], tags: ['milk'],
    ingredients: [{ foodId: 'f_milk', grams: 250, scalable: true }],
    steps: ['可直接饮用或温热'],
  },
  {
    id: 'r_milk_low_fat_cup', name: '低脂牛奶一杯', slot: 'protein', mealFit: ['breakfast'], tags: ['milk'],
    ingredients: [{ foodId: 'f_milk_low_fat', grams: 250, scalable: true }],
    steps: ['可直接饮用或温热'],
  },
  {
    id: 'r_yogurt_bowl', name: '无糖酸奶', slot: 'protein', mealFit: ['breakfast'], tags: ['milk'],
    ingredients: [{ foodId: 'f_yogurt_plain', grams: 200, scalable: true }],
    steps: ['可直接吃,或撒少许坚果碎'],
  },
  {
    id: 'r_soy_milk_cup', name: '无糖豆浆', slot: 'protein', mealFit: ['breakfast'], tags: ['soy'],
    ingredients: [{ foodId: 'f_soy_milk', grams: 250, scalable: true }],
    steps: ['豆浆机或市售无糖豆浆,温热饮用'],
  },
  {
    id: 'r_tofu_pudding', name: '豆腐脑', slot: 'protein', mealFit: ['breakfast'], tags: ['soy'],
    ingredients: [{ foodId: 'f_tofu_soft', grams: 300, scalable: true }],
    steps: ['内酯豆腐蒸5分钟', '浇少量生抽、香油、葱花(咸口)'],
  },
  {
    id: 'r_quail_eggs', name: '鹌鹑蛋一盒', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [{ foodId: 'f_quail_egg', grams: 100, scalable: true }],
    steps: ['冷水下锅煮5分钟,约10个'],
  },
  {
    id: 'r_black_bean_milk', name: '黑豆浆', slot: 'protein', mealFit: ['breakfast'], tags: ['soy'],
    ingredients: [{ foodId: 'f_black_bean_dry', grams: 40, scalable: true }],
    steps: ['黑豆浸泡过夜,豆浆机打成浆,不滤渣更营养'],
  },
  {
    id: 'r_boiled_egg_white', name: '水煮蛋白', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [{ foodId: 'f_egg_white', grams: 200, scalable: true }],
    steps: ['鸡蛋煮熟取蛋白,约6个鸡蛋的蛋白'],
  },
  {
    id: 'r_cottage_cheese_bowl', name: '茅屋奶酪碗', slot: 'protein', mealFit: ['breakfast'], tags: ['milk'],
    ingredients: [{ foodId: 'f_cottage_cheese', grams: 150, scalable: true }],
    steps: ['可直接吃', '可加黄瓜丁、黑胡椒做成咸口,或拌蓝莓做甜口'],
  },
  {
    id: 'r_egg_white_omelet', name: '蛋白煎蛋卷', slot: 'protein', mealFit: ['breakfast'], tags: ['egg'],
    ingredients: [
      { foodId: 'f_egg', grams: 50, scalable: true },
      { foodId: 'f_egg_white', grams: 100, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['1个鸡蛋加3个蛋白打散', '少油小火煎成蛋卷,可卷入蔬菜碎'],
  },
  {
    id: 'r_chickpea_salad', name: '凉拌鹰嘴豆', slot: 'protein', mealFit: ['breakfast', 'lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_chickpea_cooked', grams: 180, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['熟鹰嘴豆(罐头或提前煮好)冲洗', '加洋葱碎、欧芹、柠檬汁、橄榄油拌匀'],
  },

  // ================= 蛋白 —— 午晚组 =================
  {
    id: 'r_pan_fried_chicken', name: '香煎鸡胸肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [
      { foodId: 'f_chicken_breast', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['鸡胸横刀切片,盐、黑胡椒、蒜末腌10分钟', '平底锅少油,中火每面煎2-3分钟'],
  },
  {
    id: 'r_boiled_chicken', name: '水煮鸡胸', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [{ foodId: 'f_chicken_breast', grams: 150, scalable: true }],
    steps: ['冷水下锅加姜片料酒,水开后小火煮10分钟', '捞出撕条,蘸少量生抽'],
  },
  {
    id: 'r_chicken_leg_roast', name: '烤去皮鸡腿', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [
      { foodId: 'f_chicken_leg', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鸡腿去皮划刀,盐黑胡椒孜然腌20分钟', '烤箱200℃烤20分钟'],
  },
  {
    id: 'r_braised_beef_shank', name: '卤牛腱', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['beef'],
    ingredients: [{ foodId: 'f_beef_shank', grams: 120, scalable: true }],
    steps: ['牛腱冷水下锅焯水', '加卤料(生抽、八角、桂皮、香叶)小火卤60分钟', '晾凉切片'],
  },
  {
    id: 'r_black_pepper_beef', name: '黑椒牛肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['beef'],
    ingredients: [
      { foodId: 'f_beef_lean', grams: 130, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['牛肉逆纹切片,生抽淀粉抓匀腌15分钟', '大火快炒至变色,撒黑椒碎出锅'],
  },
  {
    id: 'r_pork_loin_slice', name: '白灼里脊片', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [{ foodId: 'f_pork_loin', grams: 130, scalable: true }],
    steps: ['里脊切薄片,加蛋清淀粉抓匀', '水微开时下肉片烫至变白捞出,蘸少量生抽'],
  },
  {
    id: 'r_stir_fried_pork_lean', name: '小炒瘦肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_leg', grams: 130, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['瘦肉切片腌10分钟', '少油大火快炒,加少许青椒同炒更香'],
  },
  {
    id: 'r_lamb_stew', name: '清炖羊肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['lamb'],
    ingredients: [{ foodId: 'f_lamb_lean', grams: 130, scalable: true }],
    steps: ['羊肉焯水去浮沫', '加姜片、葱段、白萝卜块,小火炖50分钟,出锅撒盐'],
  },
  {
    id: 'r_duck_breast_pan', name: '香煎鸭胸', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['duck'],
    ingredients: [
      { foodId: 'f_duck_breast', grams: 130, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鸭胸去皮划格纹,盐黑胡椒腌15分钟', '中火每面煎3分钟,静置2分钟再切'],
  },
  {
    id: 'r_steamed_bass', name: '清蒸鲈鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_bass', grams: 200, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鱼身划刀,放姜片,水开后蒸8分钟', '浇少量蒸鱼豉油、葱丝,热油激香'],
  },
  {
    id: 'r_pan_fried_salmon', name: '香煎三文鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [{ foodId: 'f_salmon', grams: 130, scalable: true }],
    steps: ['三文鱼吸干水分,撒盐黑胡椒', '不带油冷锅下鱼,煎出鱼油后每面煎2分钟'],
  },
  {
    id: 'r_steamed_cod', name: '清蒸鳕鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_cod', grams: 180, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鳕鱼放姜片料酒,水开后蒸8分钟', '淋少量生抽、葱丝'],
  },
  {
    id: 'r_pan_fried_basa', name: '香煎龙利鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_basa', grams: 180, scalable: true },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['龙利鱼柳切段,盐黑胡椒柠檬汁腌10分钟', '少油中火每面煎2-3分钟'],
  },
  {
    id: 'r_boiled_shrimp', name: '白灼虾', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [{ foodId: 'f_shrimp', grams: 150, scalable: true }],
    steps: ['水开加姜片料酒,下虾煮2-3分钟至弯身变红', '蘸少量生抽或醋'],
  },
  {
    id: 'r_squid_stir_fry', name: '爆炒鱿鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_squid', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['鱿鱼切花刀焯水10秒', '少油大火快炒,加洋葱青椒、少量豆瓣酱'],
  },
  {
    id: 'r_clam_broth', name: '清汤蛤蜊', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [{ foodId: 'f_clam', grams: 300, scalable: true }],
    steps: ['蛤蜊吐沙洗净', '清水加姜片煮开口,撒葱花少许盐'],
  },
  {
    id: 'r_tuna_salad', name: '金枪鱼(水浸)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [{ foodId: 'f_tuna_canned', grams: 120, scalable: true }],
    steps: ['水浸金枪鱼沥去水分', '可拌生菜、玉米粒,加少量黑胡椒'],
  },
  {
    id: 'r_pan_fried_tofu', name: '香煎北豆腐', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_tofu_firm', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['北豆腐切厚片吸干水分', '少油煎至两面金黄,撒盐孜然或蘸生抽'],
  },
  {
    id: 'r_dried_tofu_cold', name: '凉拌豆腐干', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [{ foodId: 'f_tofu_dried', grams: 100, scalable: true }],
    steps: ['豆腐干切丝焯水', '加葱丝、生抽、香油、少量辣椒油拌匀'],
  },
  {
    id: 'r_edamame_boiled', name: '盐水毛豆', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [{ foodId: 'f_edamame', grams: 180, scalable: true }],
    steps: ['毛豆剪角洗净', '盐水加八角煮8分钟,泡30分钟入味'],
  },
  {
    id: 'r_mapo_tofu', name: '麻婆豆腐(少油版)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy', 'spicy'],
    ingredients: [
      { foodId: 'f_tofu_firm', grams: 200, scalable: true },
      { foodId: 'f_olive_oil', grams: 8, scalable: false },
    ],
    steps: ['豆腐切块盐水焯定型', '少油下豆瓣酱炒出红油,加水下豆腐煮5分钟', '水淀粉勾芡,撒花椒粉葱花'],
  },
  {
    id: 'r_shrimp_broccoli', name: '虾仁炒西兰花', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_shrimp', grams: 150, scalable: true },
      { foodId: 'f_broccoli', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['虾仁开背去线,西兰花焯水1分钟', '少油快炒虾仁至变红,下西兰花同炒,加盐'],
  },
  {
    id: 'r_boiled_fish_slices', name: '水煮鱼片', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood', 'spicy'],
    ingredients: [
      { foodId: 'f_basa', grams: 180, scalable: true },
      { foodId: 'f_mung_bean_sprout', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 8, scalable: false },
    ],
    steps: ['鱼片用盐、蛋清、淀粉抓匀', '豆芽垫底,鱼片汆至变白捞出', '干辣椒花椒热油浇上'],
  },
  {
    id: 'r_steamed_pork_rice_flour', name: '粉蒸里脊', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_loin', grams: 130, scalable: true },
      { foodId: 'f_rice', grams: 20, scalable: true },
    ],
    steps: ['大米干锅炒至微黄,打成粗粉', '里脊切片裹米粉,加少量生抽', '上锅蒸40分钟'],
  },
  {
    id: 'r_stir_fried_pork_liver', name: '爆炒猪肝', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_liver', grams: 120, scalable: true },
      { foodId: 'f_olive_oil', grams: 8, scalable: false },
    ],
    steps: ['猪肝切薄片,清水泡去血水,料酒淀粉抓匀', '大火快炒30秒至变色,加洋葱青椒出锅'],
  },
  {
    id: 'r_braised_beef_brisket', name: '红烧牛腩', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['beef'],
    ingredients: [
      { foodId: 'f_beef_brisket', grams: 120, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['牛腩焯水,少油煸炒上色', '加生抽老抽、八角、桂皮,炖90分钟至软烂'],
  },
  {
    id: 'r_braised_chicken_wing', name: '红烧鸡翅', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [
      { foodId: 'f_chicken_wing', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鸡翅划刀焯水', '少油煎至两面金黄,加生抽老抽冰糖焖15分钟'],
  },
  {
    id: 'r_clam_steamed_egg', name: '蛤蜊蒸蛋', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood', 'egg'],
    ingredients: [
      { foodId: 'f_clam', grams: 150, scalable: true },
      { foodId: 'f_egg', grams: 100, scalable: true },
    ],
    steps: ['蛤蜊吐沙焯水取肉', '鸡蛋打散加1.2倍温水,放入蛤蜊肉蒸10分钟'],
  },
  {
    id: 'r_lamb_scallion', name: '葱爆羊肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['lamb'],
    ingredients: [
      { foodId: 'f_lamb_lean', grams: 130, scalable: true },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['羊肉逆纹切片,生抽料酒腌10分钟', '大火爆炒,下大葱段翻匀即出锅'],
  },
  {
    id: 'r_garlic_oyster', name: '蒜蓉蒸生蚝', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_oyster', grams: 200, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['生蚝刷净撬开', '铺蒜蓉,水开后蒸5分钟', '淋少量生抽热油'],
  },
  {
    id: 'r_crucian_tofu_soup', name: '鲫鱼豆腐汤', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood', 'soy'],
    ingredients: [
      { foodId: 'f_crucian', grams: 150, scalable: true },
      { foodId: 'f_tofu_soft', grams: 100, scalable: true },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['鲫鱼煎至两面微黄', '加开水大火滚10分钟至汤白,下豆腐再煮5分钟,加盐葱花'],
  },
  {
    id: 'r_tofu_sheet_pork', name: '千张肉丝', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork', 'soy'],
    ingredients: [
      { foodId: 'f_tofu_sheet', grams: 80, scalable: true },
      { foodId: 'f_pork_loin', grams: 80, scalable: true },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['千张切丝焯水,里脊切丝腌10分钟', '少油滑炒肉丝,下千张丝、青椒丝同炒'],
  },
  {
    id: 'r_razor_clam_blanched', name: '白灼蛏子', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [{ foodId: 'f_razor_clam', grams: 250, scalable: true }],
    steps: ['蛏子吐沙洗净', '水开加姜片料酒,煮2-3分钟开口即捞,蘸姜醋汁'],
  },
  {
    id: 'r_braised_ribs', name: '红烧排骨', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_ribs', grams: 120, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['排骨焯水,少油煸炒,加生抽老抽冰糖', '加热水没过,炖50分钟收汁'],
  },
  {
    id: 'r_spicy_chicken_cubes', name: '辣子鸡丁(少油版)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken', 'spicy'],
    ingredients: [
      { foodId: 'f_chicken_breast', grams: 150, scalable: true },
      { foodId: 'f_olive_oil', grams: 8, scalable: false },
    ],
    steps: ['鸡胸切丁,盐料酒腌15分钟', '少油煎至微黄,加干辣椒、花椒翻炒出香', '出锅前撒熟芝麻'],
  },
  {
    id: 'r_country_pork_stir_fry', name: '农家小炒肉(瘦)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_leg', grams: 120, scalable: true },
      { foodId: 'f_green_pepper', grams: 100, scalable: false },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['瘦肉切薄片,生抽腌10分钟', '少油煸炒肉片,下青椒片大火同炒'],
  },
  {
    id: 'r_steamed_bass_chili', name: '剁椒蒸鲈鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood', 'spicy'],
    ingredients: [
      { foodId: 'f_bass', grams: 200, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鱼身划刀,铺剁椒、姜丝', '水开后蒸8-10分钟,淋热油'],
  },
  {
    id: 'r_white_cut_chicken', name: '白切鸡(去皮)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [{ foodId: 'f_chicken_leg', grams: 150, scalable: true }],
    steps: ['鸡腿冷水下锅加姜片,水开后小火煮12分钟', '关火焖5分钟,冰水过凉去皮切片,蘸姜葱蓉'],
  },
  {
    id: 'r_ribs_black_bean', name: '豉汁蒸排骨', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_ribs', grams: 120, scalable: true },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['排骨斩小块洗净沥干', '加豆豉、蒜末、生抽腌20分钟,上锅蒸25分钟'],
  },
  {
    id: 'r_lions_head_meatball', name: '清炖狮子头(瘦)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['pork'],
    ingredients: [
      { foodId: 'f_pork_loin', grams: 130, scalable: true },
      { foodId: 'f_egg_white', grams: 30, scalable: true },
    ],
    steps: ['里脊剁碎,加蛋白、葱姜水、盐搅拌上劲', '团成大丸,温水下锅小火炖40分钟,可加青菜心'],
  },
  {
    id: 'r_tomato_beef_stew', name: '番茄炖牛腩', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['beef'],
    ingredients: [
      { foodId: 'f_beef_brisket', grams: 120, scalable: true },
      { foodId: 'f_tomato', grams: 100, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['牛腩焯水,番茄去皮切块炒出汁', '加水没过牛腩,炖90分钟至软烂,加盐'],
  },
  {
    id: 'r_chicken_mushroom_stew', name: '小鸡炖蘑菇', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [
      { foodId: 'f_chicken_leg', grams: 150, scalable: true },
      { foodId: 'f_shiitake', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['鸡腿去骨切块焯水', '少油煸炒,加香菇、生抽,炖30分钟'],
  },
  {
    id: 'r_big_plate_chicken', name: '大盘鸡(少油版)', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['chicken'],
    ingredients: [
      { foodId: 'f_chicken_leg', grams: 150, scalable: true },
      { foodId: 'f_potato', grams: 100, scalable: false },
      { foodId: 'f_green_pepper', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['鸡腿去皮切块焯水(数据按去皮口径计)', '少油煸炒,加土豆、生抽老抽、辣椒,炖25分钟', '收汁前下青椒块'],
  },
  {
    id: 'r_yuba_celery', name: '腐竹拌芹菜', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_yuba', grams: 60, scalable: true },
      { foodId: 'f_celery', grams: 100, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 4, scalable: false },
    ],
    steps: ['腐竹温水泡发切段,焯水1分钟', '芹菜切段焯水,加盐、香油、蒜末拌匀'],
  },
  {
    id: 'r_braised_veg_chicken', name: '红烧素鸡', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_vegetarian_chicken', grams: 120, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['素鸡切厚片,少油煎至两面金黄', '加生抽、少量糖和水,焖5分钟收汁'],
  },
  {
    id: 'r_double_mushroom_tofu', name: '双菇烧豆腐', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_tofu_firm', grams: 150, scalable: true },
      { foodId: 'f_shiitake', grams: 50, scalable: false },
      { foodId: 'f_mushroom', grams: 50, scalable: false },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['豆腐切块煎至微黄', '下双菇翻炒,加生抽、半碗水焖5分钟'],
  },
  {
    id: 'r_steamed_pomfret', name: '清蒸鲳鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_pomfret', grams: 180, scalable: true },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['鲳鱼划刀,放姜丝,水开后蒸8分钟', '淋蒸鱼豉油、葱丝,热油激香'],
  },
  {
    id: 'r_garlic_scallop', name: '蒜蓉蒸扇贝', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_scallop', grams: 250, scalable: true },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['扇贝刷净取肉,壳留用', '铺蒜蓉,水开后蒸5分钟,淋少量生抽热油'],
  },
  {
    id: 'r_onion_squid', name: '洋葱炒鱿鱼', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_squid', grams: 150, scalable: true },
      { foodId: 'f_onion', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['鱿鱼切花刀焯水10秒', '洋葱炒香,下鱿鱼大火翻炒,加黑椒或孜然'],
  },
  {
    id: 'r_braised_rabbit', name: '红烧兔丁', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: ['rabbit'],
    ingredients: [
      { foodId: 'f_rabbit', grams: 140, scalable: true },
      { foodId: 'f_olive_oil', grams: 6, scalable: false },
    ],
    steps: ['兔肉切丁焯水', '少油煸炒,加生抽、八角,炖30分钟收汁(高蛋白低脂)'],
  },

  // ================= 蔬菜(vegetable,固定份) =================
  {
    id: 'r_broccoli_boiled', name: '白灼西兰花', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_broccoli', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['西兰花掰小朵盐水浸泡', '水开焯2分钟', '淋少量生抽热油'],
  },
  {
    id: 'r_greens_garlic', name: '蒜蓉油麦菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_oleifera', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['油麦菜切段', '蒜末爆香,大火快炒1分钟,加盐出锅'],
  },
  {
    id: 'r_spinach_stir_fry', name: '清炒菠菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_spinach', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['菠菜焯水10秒去草酸', '少油快炒,加蒜末盐'],
  },
  {
    id: 'r_lettuce_oyster', name: '蚝油生菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_lettuce', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['生菜焯水10秒装盘', '少量蚝油生抽加水勾芡,浇在生菜上'],
  },
  {
    id: 'r_cucumber_salad', name: '凉拌黄瓜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_cucumber', grams: 200, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['黄瓜拍碎切段', '加蒜末、生抽、醋、香油拌匀'],
  },
  {
    id: 'r_tomato_raw', name: '生番茄', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [{ foodId: 'f_tomato', grams: 200, scalable: false }],
    steps: ['洗净直接吃,或切片撒少许黑胡椒'],
  },
  {
    id: 'r_cabbage_hand_torn', name: '手撕包菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_cabbage', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['包菜手撕成片', '蒜片干辣椒爆香,大火快炒2分钟'],
  },
  {
    id: 'r_green_bean_fry', name: '清炒四季豆', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_green_bean', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['四季豆掰段,务必炒熟透(防皂苷中毒)', '蒜末爆香,中火炒5分钟至表皮起皱'],
  },
  {
    id: 'r_zucchini_garlic', name: '蒜蓉西葫芦', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_zucchini', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['西葫芦切片', '蒜末爆香,中火炒2-3分钟'],
  },
  {
    id: 'r_baby_cabbage_broth', name: '上汤娃娃菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_baby_cabbage', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['娃娃菜切条', '清水或高汤煮3分钟,加盐葱花'],
  },
  {
    id: 'r_chinese_cabbage_vinegar', name: '醋溜白菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_chinese_cabbage', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['白菜帮斜刀切片', '干辣椒爆香,大火快炒,烹醋加盐'],
  },
  {
    id: 'r_asparagus_fry', name: '清炒芦笋', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_asparagus', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['芦笋去老根切段,焯水1分钟', '少油快炒,加盐黑胡椒'],
  },
  {
    id: 'r_enoki_garlic', name: '蒜蓉金针菇', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_enoki', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['金针菇去根洗净', '蒜末生抽拌匀,水开后蒸8分钟'],
  },
  {
    id: 'r_mushroom_greens', name: '香菇炒油麦菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_shiitake', grams: 100, scalable: false },
      { foodId: 'f_oleifera', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['香菇切片煸出香味', '下油麦菜大火快炒1分钟,加盐'],
  },
  {
    id: 'r_okra_blanched', name: '白灼秋葵', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_okra', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['秋葵整根焯水2分钟', '切去蒂,淋生抽热油'],
  },
  {
    id: 'r_wax_gourd_soup', name: '冬瓜汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_wax_gourd', grams: 250, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 2, scalable: false },
    ],
    steps: ['冬瓜切片', '清水煮10分钟至透明,加盐、香油、葱花'],
  },
  {
    id: 'r_carrot_fry', name: '清炒胡萝卜丝', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_carrot', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['胡萝卜擦丝', '少油中火炒3分钟(油炒有助胡萝卜素吸收)'],
  },
  {
    id: 'r_celery_fry', name: '清炒芹菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_celery', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['芹菜去叶切段,焯水1分钟', '蒜末爆香快炒,加盐'],
  },
  {
    id: 'r_garlic_broccoli', name: '蒜蓉西兰花', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_broccoli', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['西兰花掰小朵焯水1分钟', '蒜末爆香,大火快炒1分钟,加盐'],
  },
  {
    id: 'r_wood_ear_salad', name: '凉拌木耳', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_wood_ear', grams: 200, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['木耳泡发撕小朵,焯水2分钟', '加蒜末、生抽、醋、香油拌匀'],
  },
  {
    id: 'r_kelp_salad', name: '凉拌海带丝', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_kelp', grams: 200, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['海带切丝焯水3分钟', '加蒜末、生抽、醋、少许糖拌匀'],
  },
  {
    id: 'r_bean_sprout_fry', name: '清炒豆芽', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_mung_bean_sprout', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['豆芽洗净沥干', '干辣椒爆香,大火快炒2分钟,加醋盐出锅'],
  },
  {
    id: 'r_chrysanthemum_fry', name: '清炒茼蒿', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_chrysanthemum_greens', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['茼蒿洗净切段', '蒜末爆香,大火快炒1分钟,加盐'],
  },
  {
    id: 'r_shepherd_fry', name: '清炒荠菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_shepherd_s_purse', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['荠菜洗净焯水10秒', '蒜末爆香快炒,加盐'],
  },
  {
    id: 'r_bitter_melon_salad', name: '凉拌苦瓜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_bitter_melon', grams: 150, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['苦瓜去瓤切薄片,盐水焯1分钟过凉', '加蒜末、生抽、醋、香油拌匀'],
  },
  {
    id: 'r_water_bamboo_fry', name: '清炒茭白', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_water_bamboo', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['茭白去皮切片', '少油中火炒3分钟,加盐'],
  },
  {
    id: 'r_lotus_root_salad', name: '凉拌藕片', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_lotus_root', grams: 150, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['莲藕去皮切薄片,焯水1分钟过凉', '加蒜末、生抽、醋、香油拌匀'],
  },
  {
    id: 'r_konjac_cucumber', name: '魔芋拌黄瓜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_konjac', grams: 200, scalable: false },
      { foodId: 'f_cucumber', grams: 100, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['魔芋结焯水2分钟', '黄瓜拍块,加蒜末、生抽、醋、辣椒油拌匀'],
  },
  {
    id: 'r_shrimp_skin_zucchini', name: '虾皮炒西葫芦', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['seafood'],
    ingredients: [
      { foodId: 'f_zucchini', grams: 200, scalable: false },
      { foodId: 'f_dried_small_shrimp', grams: 10, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['西葫芦切片', '虾皮爆香,下西葫芦炒2分钟,加盐'],
  },
  {
    id: 'r_laver_soup', name: '紫菜汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_laver', grams: 5, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 2, scalable: false },
    ],
    steps: ['水开下紫菜煮1分钟', '加盐、香油、葱花'],
  },
  {
    id: 'r_garlic_bok_choy', name: '蒜蓉小油菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_bok_choy', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['小油菜对半切开洗净', '蒜末爆香,大火快炒1分钟,加盐'],
  },
  {
    id: 'r_celtuce_fry', name: '清炒莴笋片', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_celtuce', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['莴笋去皮切片,可焯水30秒', '蒜末爆香快炒1分钟,加盐'],
  },
  {
    id: 'r_garlic_sprout_fry', name: '素炒蒜薹', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_garlic_sprout', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['蒜薹掐段洗净', '少油中火炒3-4分钟至断生,加盐'],
  },
  {
    id: 'r_snow_pea_fry', name: '清炒荷兰豆', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_snow_pea', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['荷兰豆去筋洗净', '蒜末爆香大火炒2分钟(务必炒熟),加盐'],
  },
  {
    id: 'r_onion_fry', name: '素炒洋葱', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_onion', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 4, scalable: false },
    ],
    steps: ['洋葱切丝', '少油中火炒至透明微焦,加盐黑胡椒'],
  },
  {
    id: 'r_tiger_skin_pepper', name: '虎皮青椒(少油)', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_green_pepper', grams: 150, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['青椒整根拍扁', '少油中小火煸出虎皮斑,加生抽醋焖1分钟'],
  },
  {
    id: 'r_soybean_sprout_fry', name: '素炒黄豆芽', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_soybean_sprout', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['黄豆芽洗净', '干辣椒爆香,中火炒4-5分钟炒透,加盐'],
  },
  {
    id: 'r_amaranth_garlic', name: '蒜蓉苋菜', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_amaranth', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['苋菜洗净去老根', '蒜末爆香,大火快炒1分钟,加盐'],
  },
  {
    id: 'r_tomato_egg', name: '番茄炒蛋', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['egg'],
    ingredients: [
      { foodId: 'f_tomato', grams: 200, scalable: false },
      { foodId: 'f_egg', grams: 50, scalable: false },
      { foodId: 'f_olive_oil', grams: 7, scalable: false },
    ],
    steps: ['1个鸡蛋打散,少油炒成块盛出', '番茄切块炒出汁,倒回蛋块,加盐少量糖'],
  },
  {
    id: 'r_tomato_tofu_soup', name: '番茄豆腐汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_tomato', grams: 150, scalable: false },
      { foodId: 'f_tofu_soft', grams: 80, scalable: false },
      { foodId: 'f_olive_oil', grams: 3, scalable: false },
    ],
    steps: ['番茄炒出汁加水煮开', '下豆腐块煮3分钟,加盐葱花'],
  },
  {
    id: 'r_loofah_egg_soup', name: '丝瓜蛋汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['egg'],
    ingredients: [
      { foodId: 'f_loofah', grams: 150, scalable: false },
      { foodId: 'f_egg', grams: 50, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['丝瓜去皮切滚刀块,加水煮3分钟', '淋蛋液成蛋花,加盐香油'],
  },
  {
    id: 'r_white_radish_soup', name: '白萝卜汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_white_radish', grams: 200, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 2, scalable: false },
    ],
    steps: ['白萝卜切片', '清水煮8分钟至透明,加盐、白胡椒、葱花'],
  },
  {
    id: 'r_greens_tofu_soup', name: '青菜豆腐汤', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: ['soy'],
    ingredients: [
      { foodId: 'f_bok_choy', grams: 150, scalable: false },
      { foodId: 'f_tofu_soft', grams: 80, scalable: false },
      { foodId: 'f_flaxseed_oil', grams: 3, scalable: false },
    ],
    steps: ['水开下豆腐块煮2分钟', '下小油菜煮1分钟,加盐香油'],
  },
  {
    id: 'r_yam_fry', name: '清炒山药片', slot: 'vegetable', mealFit: ['lunch', 'dinner'], tags: [],
    ingredients: [
      { foodId: 'f_yam', grams: 200, scalable: false },
      { foodId: 'f_olive_oil', grams: 5, scalable: false },
    ],
    steps: ['山药去皮切片泡醋水防黑', '木耳胡萝卜可同炒,大火炒2分钟,加盐'],
  },

  // ================= 水果(fruit,固定份) =================
  { id: 'r_apple_one', name: '苹果一个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_apple', grams: 200, scalable: false }], steps: ['洗净带皮吃'] },
  { id: 'r_banana_one', name: '香蕉一根', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_banana', grams: 120, scalable: false }], steps: ['直接吃'] },
  { id: 'r_orange_one', name: '橙子一个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_orange', grams: 200, scalable: false }], steps: ['去皮分瓣吃'] },
  { id: 'r_blueberry_box', name: '蓝莓一盒', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_blueberry', grams: 100, scalable: false }], steps: ['冲洗后直接吃'] },
  { id: 'r_strawberry_bowl', name: '草莓一碗', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_strawberry', grams: 200, scalable: false }], steps: ['冲洗去蒂'] },
  { id: 'r_kiwi_two', name: '猕猴桃两个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_kiwi', grams: 160, scalable: false }], steps: ['对半切开用勺吃'] },
  { id: 'r_cherry_tomato_bowl', name: '圣女果一碗', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_cherry_tomato', grams: 200, scalable: false }], steps: ['洗净直接吃'] },
  { id: 'r_grape_bunch', name: '葡萄一串', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_grape', grams: 150, scalable: false }], steps: ['洗净直接吃'] },
  { id: 'r_pomelo_slice', name: '柚子两瓣', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_pomelo', grams: 200, scalable: false }], steps: ['去皮取肉'] },
  { id: 'r_watermelon_slice', name: '西瓜一块', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_watermelon', grams: 300, scalable: false }], steps: ['切块直接吃'] },
  { id: 'r_hami_melon', name: '哈密瓜两块', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_hami_melon', grams: 250, scalable: false }], steps: ['去皮切块'] },
  { id: 'r_cherry_bowl', name: '樱桃一碗', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_cherry', grams: 150, scalable: false }], steps: ['洗净带柄吃'] },
  { id: 'r_fresh_jujube', name: '鲜枣几颗', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_fresh_jujube', grams: 100, scalable: false }], steps: ['洗净直接吃'] },
  { id: 'r_pineapple', name: '菠萝几块', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_pineapple', grams: 200, scalable: false }], steps: ['切片盐水泡10分钟'] },
  { id: 'r_dragon_fruit', name: '火龙果半个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_dragon_fruit', grams: 200, scalable: false }], steps: ['对半切开用勺吃'] },
  { id: 'r_lychee', name: '荔枝几颗', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_lychee', grams: 150, scalable: false }], steps: ['剥壳直接吃'] },
  { id: 'r_avocado_half', name: '牛油果半个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_avocado', grams: 100, scalable: false }], steps: ['对半切开,撒少许黑胡椒或挤柠檬汁用勺吃'] },
  { id: 'r_mango', name: '芒果一个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_mango', grams: 200, scalable: false }], steps: ['贴核切三片,划十字翻起用勺吃'] },
  { id: 'r_papaya', name: '木瓜半个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_papaya', grams: 250, scalable: false }], steps: ['对半切开去籽,用勺挖着吃'] },
  { id: 'r_persimmon', name: '柿子一个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_persimmon', grams: 150, scalable: false }], steps: ['去皮直接吃(不与大量高蛋白同餐)'] },
  { id: 'r_mandarin', name: '橘子两个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_mandarin', grams: 160, scalable: false }], steps: ['剥皮分瓣吃'] },
  { id: 'r_pomegranate', name: '石榴一个', slot: 'fruit', mealFit: ['breakfast'], tags: [],
    ingredients: [{ foodId: 'f_pomegranate', grams: 200, scalable: false }], steps: ['切块剥籽吃'] },
]

// 食谱抗炎派生:含 ≥2 种非油抗炎食材,或含 ≥80g 非油抗炎主料(如 200g 西兰花
// 单品)即标注。油类不计入"种数"——否则"5g 紫菜 + 2g 油"也凑成两种,标签失去
// 区分度(紫菜汤曾因此误标)
const OIL_IDS = new Set(['f_olive_oil', 'f_peanut_oil', 'f_flaxseed_oil'])

export const RECIPES = RAW_RECIPES.map((r) => {
  const antiIngs = r.ingredients.filter(
    (i) => FOODS_MAP[i.foodId]?.antiInfl && !OIL_IDS.has(i.foodId)
  )
  const mainAntiGrams = antiIngs.reduce((s, i) => s + i.grams, 0)
  return { ...r, antiInfl: antiIngs.length >= 2 || mainAntiGrams >= 80 }
})

export const RECIPES_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
