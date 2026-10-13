// 食谱库(种子数据)
//
// 基准份说明:
// - staple/protein 槽的可缩放食材(scalable: true)会被规划器按目标热量/蛋白
//   乘系数调整克数,基准份取成人一餐的常见量(干重60-80g / 生肉120-150g / 薯类200g)
// - vegetable/fruit 槽为固定份,不缩放
// - 调味料不进入食材表,写在做法里;油计入食材(对减脂热量影响显著)

// { id, name, slot, mealFit, tags, ingredients: [{foodId, grams, scalable}], steps }
export const RECIPES = [
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
    ingredients: [{ foodId: 'f_soy_milk', grams: 300, scalable: true }],
    steps: ['豆浆机或市售无糖豆浆,温热饮用'],
  },
  {
    id: 'r_tofu_pudding', name: '豆腐脑', slot: 'protein', mealFit: ['breakfast'], tags: ['soy'],
    ingredients: [{ foodId: 'f_tofu_soft', grams: 300, scalable: true }],
    steps: ['内酯豆腐蒸5分钟', '浇少量生抽、香油、葱花(咸口)'],
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
    id: 'r_lamb_stew', name: '清炖羊肉', slot: 'protein', mealFit: ['lunch', 'dinner'], tags: [],
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
]

export const RECIPES_MAP = Object.fromEntries(RECIPES.map((r) => [r.id, r]))
