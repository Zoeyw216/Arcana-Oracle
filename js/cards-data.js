// 22 Major Arcana - complete card data
export const majorArcana = [
  {
    id: 0, numeral: '0', name: '愚者', nameEn: 'The Fool',
    colors: { primary: '#E8C547', secondary: '#7CB342', bg: 'linear-gradient(135deg, #1a1a0a, #1a2410)' },
    upright: '新开始、冒险、自由、天真、无限可能',
    reversed: '鲁莽、犹豫不决、冒险过度、缺乏计划',
    uprightDesc: '愚者代表着新的旅程即将开始，充满了无限的可能性。此时宜保持开放的心态，大胆地迈出第一步，相信宇宙的引导。',
    reversedDesc: '逆位的愚者提醒你需要更加谨慎。或许你正在做出鲁莽的决定，需要停下来认真考虑后果。',
    svgPath: 'M60,25 Q65,15 70,25 L75,45 Q70,50 65,45 Z M55,50 L75,50 L70,90 L60,90 Z M50,90 L80,90 M45,95 Q65,85 85,95',
    element: 'air'
  },
  {
    id: 1, numeral: 'I', name: '魔术师', nameEn: 'The Magician',
    colors: { primary: '#E53935', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #1a0a0a, #1a1508)' },
    upright: '创造力、意志力、技能、行动力、专注',
    reversed: '欺骗、操控、缺乏方向、才华浪费',
    uprightDesc: '魔术师告诉你，你拥有实现目标所需的一切资源和能力。现在是将想法付诸行动的最佳时机。',
    reversedDesc: '逆位的魔术师暗示你可能没有充分利用自己的才能，或者有人试图欺骗你。审视当前状况，确保一切真实可靠。',
    svgPath: 'M65,15 Q68,10 71,15 Q68,20 65,15 M55,25 L65,20 L75,25 M60,30 L70,30 M58,35 L72,35 L72,75 L58,75 Z M50,80 L80,80 L75,90 L55,90 Z',
    element: 'all'
  },
  {
    id: 2, numeral: 'II', name: '女祭司', nameEn: 'The High Priestess',
    colors: { primary: '#1565C0', secondary: '#B39DDB', bg: 'linear-gradient(135deg, #0a0e1a, #0d1525)' },
    upright: '直觉、潜意识、神秘、内在智慧、静默',
    reversed: '忽略直觉、秘密、表面化、信息缺失',
    uprightDesc: '女祭司引导你聆听内心深处的声音。答案就在你的潜意识之中，静下心来，你自然会知道该怎么做。',
    reversedDesc: '逆位的女祭司意味着你可能忽略了自己的直觉，或者有什么重要的信息被隐藏了起来。',
    svgPath: 'M60,20 Q65,15 70,20 Q65,25 60,20 M57,28 L73,28 L73,70 L57,70 Z M50,72 L80,72 L75,78 L55,78 Z M60,35 L70,35 M60,45 L70,45 M65,50 L65,65',
    element: 'water'
  },
  {
    id: 3, numeral: 'III', name: '女皇', nameEn: 'The Empress',
    colors: { primary: '#43A047', secondary: '#F48FB1', bg: 'linear-gradient(135deg, #0a1a0e, #1a0a14)' },
    upright: '丰盛、母性、创造、美、自然',
    reversed: '过度依赖、创意枯竭、忽视自我照顾',
    uprightDesc: '女皇带来丰盛和富足的能量。这是一个充满创造力和美的时期，适合培育新项目或关系。',
    reversedDesc: '逆位的女皇提醒你不要忽视自我照顾。你可能过于关注外界而忽略了自身的需求。',
    svgPath: 'M65,18 Q60,22 55,18 Q60,14 65,18 M58,25 Q65,20 72,25 L72,55 Q65,60 58,55 Z M52,58 Q65,65 78,58 L75,90 Q65,95 55,90 Z',
    element: 'earth'
  },
  {
    id: 4, numeral: 'IV', name: '皇帝', nameEn: 'The Emperor',
    colors: { primary: '#D32F2F', secondary: '#FF8F00', bg: 'linear-gradient(135deg, #1a0808, #1a1008)' },
    upright: '权威、结构、稳定、领导力、纪律',
    reversed: '专横、僵化、控制欲过强、缺乏灵活',
    uprightDesc: '皇帝象征着秩序与权威。现在需要用理性和纪律来处理事务，建立稳固的基础。',
    reversedDesc: '逆位的皇帝暗示你或周围的人可能过于专横或僵化。试着放松控制，接受一些灵活性。',
    svgPath: 'M55,20 L65,12 L75,20 L72,22 L65,16 L58,22 Z M58,25 L72,25 L72,55 L58,55 Z M55,58 L75,58 L78,65 L52,65 Z M60,68 L70,68 L70,90 L60,90 Z',
    element: 'fire'
  },
  {
    id: 5, numeral: 'V', name: '教皇', nameEn: 'The Hierophant',
    colors: { primary: '#6A1B9A', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #120a1a, #1a1508)' },
    upright: '传统、信仰、指导、教育、遵循规则',
    reversed: '打破常规、自由思考、挑战权威、叛逆',
    uprightDesc: '教皇指引你向传统智慧和精神导师寻求答案。此时适合学习和遵循既定的规则与方法。',
    reversedDesc: '逆位的教皇鼓励你跳出传统思维框架，用自己的方式来理解事物。不必盲从权威。',
    svgPath: 'M60,15 L65,10 L70,15 M58,18 L72,18 L72,22 L58,22 Z M56,25 L74,25 L74,50 Q65,55 56,50 Z M60,55 L70,55 L70,85 L60,85 Z M55,88 L75,88',
    element: 'earth'
  },
  {
    id: 6, numeral: 'VI', name: '恋人', nameEn: 'The Lovers',
    colors: { primary: '#E91E63', secondary: '#FF8A80', bg: 'linear-gradient(135deg, #1a0a12, #1a1508)' },
    upright: '爱情、和谐、选择、价值观、灵魂伴侣',
    reversed: '失衡、不和谐、错误选择、价值冲突',
    uprightDesc: '恋人牌代表着重要的选择与深层的联结。无论是爱情还是其他关系，都需要跟随内心做出真诚的选择。',
    reversedDesc: '逆位的恋人暗示关系中可能存在不和谐或价值观冲突。需要认真审视自己真正想要什么。',
    svgPath: 'M50,40 Q55,25 65,35 Q75,25 80,40 Q80,55 65,70 Q50,55 50,40 Z M65,15 L65,30 M55,20 L75,20',
    element: 'air'
  },
  {
    id: 7, numeral: 'VII', name: '战车', nameEn: 'The Chariot',
    colors: { primary: '#37474F', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #0e1215, #1a1508)' },
    upright: '意志力、胜利、决心、克服困难、行动',
    reversed: '失控、方向迷失、攻击性过强、受阻',
    uprightDesc: '战车预示着凭借坚定的意志和决心，你将战胜眼前的挑战。保持专注，勇往直前！',
    reversedDesc: '逆位的战车提醒你可能正在失去对局面的掌控。放慢脚步，重新找到方向。',
    svgPath: 'M55,20 L65,12 L75,20 Z M58,22 L72,22 L72,50 L58,50 Z M50,55 L80,55 L82,65 L48,65 Z M52,68 L58,68 L58,85 L52,85 Z M72,68 L78,68 L78,85 L72,85 Z',
    element: 'water'
  },
  {
    id: 8, numeral: 'VIII', name: '力量', nameEn: 'Strength',
    colors: { primary: '#F57F17', secondary: '#E65100', bg: 'linear-gradient(135deg, #1a1508, #1a0e0a)' },
    upright: '勇气、耐心、内在力量、温柔、自信',
    reversed: '自我怀疑、脆弱、缺乏自律、恐惧',
    uprightDesc: '力量牌告诉你真正的力量来自内心。用温柔和耐心去面对困难，你的内在比你想象的更强大。',
    reversedDesc: '逆位的力量暗示你可能正在经历自我怀疑。相信自己，你拥有克服一切的内在力量。',
    svgPath: 'M50,50 Q55,35 65,30 Q75,35 80,50 Q75,65 65,70 Q55,65 50,50 Z M55,45 Q60,40 65,42 Q60,48 55,45 M70,45 Q75,42 78,48 M58,55 Q65,62 72,55',
    element: 'fire'
  },
  {
    id: 9, numeral: 'IX', name: '隐士', nameEn: 'The Hermit',
    colors: { primary: '#4E342E', secondary: '#FDD835', bg: 'linear-gradient(135deg, #15120e, #1a1808)' },
    upright: '内省、独处、智慧、寻求真理、引导',
    reversed: '孤立、逃避、固执己见、拒绝帮助',
    uprightDesc: '隐士邀请你暂时远离喧嚣，进行深入的自我反思。在独处中你将找到照亮前路的智慧之光。',
    reversedDesc: '逆位的隐士提醒你不要过度封闭自己。适度的独处有益，但过于孤立可能让你错过重要的联系。',
    svgPath: 'M60,18 L65,12 L70,18 L67,18 L67,25 L63,25 L63,18 Z M58,28 Q65,22 72,28 L70,65 Q65,68 60,65 Z M55,70 L75,70 L72,90 L58,90 Z',
    element: 'earth'
  },
  {
    id: 10, numeral: 'X', name: '命运之轮', nameEn: 'Wheel of Fortune',
    colors: { primary: '#7B1FA2', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #120a1a, #1a1508)' },
    upright: '转变、循环、命运、机遇、好运降临',
    reversed: '逆境、抗拒变化、坏运气、失控',
    uprightDesc: '命运之轮转动，新的机遇即将到来。变化是生命的常态，顺应潮流将带来好运。',
    reversedDesc: '逆位的命运之轮暗示你可能正面临逆境或不愿接受变化。记住，低谷之后终会迎来转机。',
    svgPath: 'M65,50 m-30,0 a30,30 0 1,0 60,0 a30,30 0 1,0 -60,0 M65,50 m-20,0 a20,20 0 1,0 40,0 a20,20 0 1,0 -40,0 M65,20 L65,30 M65,70 L65,80 M35,50 L45,50 M85,50 L95,50',
    element: 'fire'
  },
  {
    id: 11, numeral: 'XI', name: '正义', nameEn: 'Justice',
    colors: { primary: '#1565C0', secondary: '#F9A825', bg: 'linear-gradient(135deg, #0a1220, #1a1508)' },
    upright: '公正、真相、因果、平衡、责任',
    reversed: '不公平、逃避责任、偏见、失衡',
    uprightDesc: '正义牌提醒你因果法则正在运作。保持公正和诚实，你将得到应有的回报。',
    reversedDesc: '逆位的正义暗示可能存在不公正的情况。审视是否有人在逃避责任，或者你是否对自己足够诚实。',
    svgPath: 'M65,18 L65,60 M50,30 L80,30 M45,35 Q50,45 50,35 M80,35 Q85,45 85,35 M55,65 L75,65 L72,90 L58,90 Z',
    element: 'air'
  },
  {
    id: 12, numeral: 'XII', name: '倒吊人', nameEn: 'The Hanged Man',
    colors: { primary: '#00838F', secondary: '#B39DDB', bg: 'linear-gradient(135deg, #0a1518, #0e0d15)' },
    upright: '放下、新视角、等待、牺牲、顿悟',
    reversed: '拖延、无谓牺牲、固执、停滞不前',
    uprightDesc: '倒吊人邀请你换一个角度看问题。有时候暂停和放下反而能带来最深刻的领悟。',
    reversedDesc: '逆位的倒吊人意味着你可能在做无谓的牺牲或过于拖延。是时候采取行动了。',
    svgPath: 'M55,20 L75,20 M65,20 L65,45 M55,45 L60,55 L70,55 L75,45 M60,58 Q65,52 70,58 Q65,64 60,58 M65,64 L65,80 M58,80 L65,90 L72,80',
    element: 'water'
  },
  {
    id: 13, numeral: 'XIII', name: '死神', nameEn: 'Death',
    colors: { primary: '#212121', secondary: '#E0E0E0', bg: 'linear-gradient(135deg, #0a0e12, #15191e)' },
    upright: '结束、转化、重生、放手、新篇章',
    reversed: '抗拒改变、恐惧结束、停滞、执着',
    uprightDesc: '死神牌并非真正的死亡，而是代表深层的转化。旧的必须结束，新的才能开始。勇敢地放手吧。',
    reversedDesc: '逆位的死神暗示你正在抗拒必要的改变。放下执着，接受转化的过程。',
    svgPath: 'M60,20 Q65,15 70,20 Q72,25 70,30 Q65,35 60,30 Q58,25 60,20 M62,22 L63,27 M67,22 L68,27 M62,28 L68,28 M58,35 L72,35 L70,70 L60,70 Z M55,72 L75,72 L72,90 L58,90 Z',
    element: 'water'
  },
  {
    id: 14, numeral: 'XIV', name: '节制', nameEn: 'Temperance',
    colors: { primary: '#00897B', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #0a1510, #1a1508)' },
    upright: '平衡、耐心、调和、适度、和谐',
    reversed: '过度、失衡、不耐烦、冲突、极端',
    uprightDesc: '节制牌引导你寻找中庸之道。保持耐心，让万事在和谐中自然发展。',
    reversedDesc: '逆位的节制提醒你生活中可能存在某种失衡。是时候调整节奏，回归平衡了。',
    svgPath: 'M65,18 Q60,22 55,18 Q60,14 65,18 M58,25 L72,25 L72,45 L58,45 Z M50,35 L55,30 M80,35 L75,30 M50,35 L50,55 M80,35 L80,55 M55,50 Q65,60 75,50 M58,65 L72,65 L70,90 L60,90 Z',
    element: 'fire'
  },
  {
    id: 15, numeral: 'XV', name: '恶魔', nameEn: 'The Devil',
    colors: { primary: '#4A148C', secondary: '#F44336', bg: 'linear-gradient(135deg, #1A0033, #311B45)' },
    upright: '束缚、欲望、沉迷、物质主义、阴暗面',
    reversed: '解脱、打破束缚、觉醒、重获自由',
    uprightDesc: '恶魔牌揭示了可能正在束缚你的欲望或习惯。意识到这些锁链的存在，是解脱的第一步。',
    reversedDesc: '逆位的恶魔是好消息——你正在打破束缚，从不健康的模式中解脱出来。',
    svgPath: 'M55,18 L60,10 L65,18 L70,10 L75,18 M58,22 L72,22 L75,50 L55,50 Z M50,55 L65,50 L80,55 M55,58 L60,58 L60,85 L55,85 Z M70,58 L75,58 L75,85 L70,85 Z M60,78 Q65,82 70,78',
    element: 'earth'
  },
  {
    id: 16, numeral: 'XVI', name: '塔', nameEn: 'The Tower',
    colors: { primary: '#BF360C', secondary: '#FFD600', bg: 'linear-gradient(135deg, #1A0A00, #3E2723)' },
    upright: '突变、崩塌、觉醒、解放、真相揭露',
    reversed: '灾难回避、抗拒变化、延迟危机',
    uprightDesc: '塔牌预示着突然的变化和旧结构的崩塌。虽然过程可能令人不安，但这是为了建立更真实的基础。',
    reversedDesc: '逆位的塔暗示你可能在努力避免一场不可避免的变化。有时候让旧的倒塌，反而是最好的出路。',
    svgPath: 'M58,90 L58,25 Q65,15 72,25 L72,90 Z M55,25 L75,25 M55,22 L65,10 L75,22 M50,35 L55,35 M75,35 L80,35 M48,50 L55,48 M75,48 L82,50 M60,40 L70,40 M60,55 L70,55 M60,70 L70,70',
    element: 'fire'
  },
  {
    id: 17, numeral: 'XVII', name: '星星', nameEn: 'The Star',
    colors: { primary: '#1565C0', secondary: '#FDD835', bg: 'linear-gradient(135deg, #0D1B2A, #1B3A5C)' },
    upright: '希望、灵感、平静、信念、疗愈',
    reversed: '失望、缺乏信心、与灵性断裂',
    uprightDesc: '星星带来希望和疗愈的能量。经历风雨之后，光明正在前方等待你。保持信念，一切都会好起来。',
    reversedDesc: '逆位的星星暗示你可能暂时失去了希望。别忘记，即使在最黑暗的夜晚，星星依然在闪耀。',
    svgPath: 'M65,20 L67,28 L75,28 L69,33 L71,42 L65,37 L59,42 L61,33 L55,28 L63,28 Z M50,50 L53,54 L50,58 M80,45 L83,49 L80,53 M45,70 L48,74 L45,78 M85,65 L88,69 L85,73',
    element: 'air'
  },
  {
    id: 18, numeral: 'XVIII', name: '月亮', nameEn: 'The Moon',
    colors: { primary: '#283593', secondary: '#C5CAE9', bg: 'linear-gradient(135deg, #0A0E2A, #1A237E)' },
    upright: '幻觉、恐惧、潜意识、直觉、迷惑',
    reversed: '走出迷雾、真相大白、克服恐惧',
    uprightDesc: '月亮提醒你，事情可能不像表面看起来那样。信任你的直觉，穿越迷雾去发现真相。',
    reversedDesc: '逆位的月亮意味着迷雾正在消散，真相即将浮现。你正在克服恐惧，走向清明。',
    svgPath: 'M55,30 Q55,15 70,15 Q60,20 60,30 Q60,40 70,45 Q55,45 55,30 Z M45,65 Q50,58 55,65 Q50,72 45,65 M75,65 Q80,58 85,65 Q80,72 75,65 M50,80 Q65,70 80,80 Q65,90 50,80',
    element: 'water'
  },
  {
    id: 19, numeral: 'XIX', name: '太阳', nameEn: 'The Sun',
    colors: { primary: '#FF8F00', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #1a1508, #1a1200)' },
    upright: '快乐、成功、活力、乐观、光明',
    reversed: '暂时受挫、过度乐观、需要现实面对',
    uprightDesc: '太阳是最积极的牌之一！成功、快乐和温暖正在向你涌来。享受这段光芒四射的时期吧。',
    reversedDesc: '逆位的太阳仍然是积极的，只是提醒你要更加务实。快乐就在不远处，只是需要一点耐心。',
    svgPath: 'M65,45 m-18,0 a18,18 0 1,0 36,0 a18,18 0 1,0 -36,0 M65,18 L65,24 M65,66 L65,72 M38,45 L44,45 M86,45 L92,45 M46,26 L50,30 M80,60 L84,64 M46,64 L50,60 M80,30 L84,26',
    element: 'fire'
  },
  {
    id: 20, numeral: 'XX', name: '审判', nameEn: 'Judgement',
    colors: { primary: '#C62828', secondary: '#FFD54F', bg: 'linear-gradient(135deg, #1a0a0a, #0a1220)' },
    upright: '觉醒、重生、召唤、反思、人生转折',
    reversed: '自我怀疑、逃避审视、错失良机',
    uprightDesc: '审判牌宣告着重要的人生转折点。听从内心的召唤，是时候做出改变、迎接重生了。',
    reversedDesc: '逆位的审判暗示你可能在逃避内心的声音或重要的自我反思。勇敢面对吧。',
    svgPath: 'M60,15 L65,10 L70,15 L68,15 L68,35 L62,35 L62,15 Z M55,38 L75,38 Q78,42 75,46 L55,46 Q52,42 55,38 Z M58,50 L72,50 L72,70 L58,70 Z M50,75 L65,70 L80,75 L75,90 L55,90 Z',
    element: 'fire'
  },
  {
    id: 21, numeral: 'XXI', name: '世界', nameEn: 'The World',
    colors: { primary: '#2E7D32', secondary: '#7B1FA2', bg: 'linear-gradient(135deg, #0a1a0e, #120a1a)' },
    upright: '完成、圆满、成就、整合、新循环',
    reversed: '未完成、缺乏终结、寻找意义',
    uprightDesc: '世界牌代表一个重要周期的圆满完成。你已经走过了完整的旅程，成就将属于你。新的循环即将开始。',
    reversedDesc: '逆位的世界暗示有些事情还没有完全完成。不要着急，确保所有松散的线头都被妥善处理。',
    svgPath: 'M65,50 m-28,0 a28,35 0 1,0 56,0 a28,35 0 1,0 -56,0 M65,50 m-15,0 a15,20 0 1,0 30,0 a15,20 0 1,0 -30,0 M45,25 L50,30 M85,25 L80,30 M45,75 L50,70 M85,75 L80,70',
    element: 'earth'
  }
];
