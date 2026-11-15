const categories = [
  { id: 'snack', label: '百醇', names: ['红酒巧克力', '柠檬挞', '巧克力', '草莓香草', '牛奶', '抹茶慕斯'] },
  { id: 'oolong', label: '乌龙茶', names: ['浅青标乌龙茶', '深蓝标乌龙茶', '红标乌龙茶', '米白标乌龙茶'] },
  { id: 'drink', label: '奶茶', names: [
    '清爽芭乐提', '三倍厚抹茶', '多肉葡萄', '芒果糯米饭', '芒芒甘露', '椰山龙眼冰',
    '咸酪碎银子', '啵啵牛乳茶', '芋泥啵啵牛乳', '超多椰肉芒芒', '奇兰粉芭乐', '去火纤体瓶',
    '满杯红柚', '纯绿茶妍后', '轻芝多肉葡萄', '雪毫茉王牛乳茶', '奇兰苹果杏', '绿妍青柠茶',
    '羽衣纤体瓶', '咸酪厚抹', '杨桃三重甘', '轻芒芝芝', '小奶茉', '嫣红牛乳茶'
  ] },
  { id: 'player', label: '像素小人', names: ['蓝白队服小人', '蓝黑队服眼镜小人', '白红队服小人'] }
];

export const inventoryTabs = [{ id: 'all', label: '全部' }, ...categories];
export const inventory = categories.flatMap(category => category.names.map((name, index) => {
  const id = category.id + '-' + String(index + 1).padStart(2, '0');
  return {
    id,
    category: category.id,
    label: category.id === 'snack' ? '百醇 · ' + name : name,
    image: './items/' + id + '.png',
    effect: { snack: '嚼嚼嚼', oolong: '喝口乌龙茶', drink: '喝一口', player: '● 直播中' }[category.id]
  };
}));
