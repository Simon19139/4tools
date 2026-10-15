'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Solar } from 'lunar-javascript';

// ============ 常量 ============

const GAN_NAMES = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI_NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const ZHI_INDEX: Record<string, number> = { '子': 0, '丑': 1, '寅': 2, '卯': 3, '辰': 4, '巳': 5, '午': 6, '未': 7, '申': 8, '酉': 9, '戌': 10, '亥': 11 };

// 十二宫名（命宫为0，逆时针排列：命、兄、夫、子、财、疾、迁、友、官、田、福、父）
const GONG_NAMES = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];

// 五行局数
const WUXING_JU: Record<string, number> = {
  '水二局': 2, '木三局': 3, '金四局': 4, '土五局': 5, '火六局': 6,
};

// 年干四化表（标准钦天门飞星派）
const SIHUA_TABLE: Record<string, { lu: string; quan: string; ke: string; ji: string }> = {
  '甲': { lu: '廉贞', quan: '破军', ke: '武曲', ji: '太阳' },
  '乙': { lu: '天机', quan: '天梁', ke: '紫微', ji: '太阴' },
  '丙': { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' },
  '丁': { lu: '太阴', quan: '天同', ke: '天机', ji: '巨门' },
  '戊': { lu: '贪狼', quan: '太阴', ke: '右弼', ji: '天机' },
  '己': { lu: '武曲', quan: '贪狼', ke: '天梁', ji: '文曲' },
  '庚': { lu: '太阳', quan: '武曲', ke: '太阴', ji: '天同' },
  '辛': { lu: '巨门', quan: '太阳', ke: '文曲', ji: '文昌' },
  '壬': { lu: '天梁', quan: '紫微', ke: '左辅', ji: '武曲' },
  '癸': { lu: '破军', quan: '巨门', ke: '太阴', ji: '贪狼' },
};

// 钦天门飞星派紫微星系各星相对于紫微星的逆时针偏移量
// 口诀：紫微天机逆行旁，隔一阳武天同当，又隔二位廉贞地，空三复见紫微郞
const ZIWEI_SYSTEM_CCW: Array<{ star: string; offset: number }> = [
  { star: '紫微', offset: 0 },
  { star: '天机', offset: 1 },
  { star: '太阳', offset: 3 },
  { star: '武曲', offset: 4 },
  { star: '天同', offset: 5 },
  { star: '廉贞', offset: 8 },
];

// 钦天门飞星派天府星系各星相对于天府星的顺时针偏移量
// 天府→太阴(顺1)→贪狼(顺2)→巨门(顺3)→天相(顺4)→天梁(顺5)→七杀(顺6)
// 七杀之后空三宫，于第四宫安破军(顺10)
const TIANFU_SYSTEM_CW: Array<{ star: string; offset: number }> = [
  { star: '天府', offset: 0 },
  { star: '太阴', offset: 1 },
  { star: '贪狼', offset: 2 },
  { star: '巨门', offset: 3 },
  { star: '天相', offset: 4 },
  { star: '天梁', offset: 5 },
  { star: '七杀', offset: 6 },
  { star: '破军', offset: 10 },
];

// 紫微盘面固定布局（4×4网格，中宫占2×2）
const GONG_LAYOUT = [
  { zhi: '巳', row: 0, col: 0 },
  { zhi: '午', row: 0, col: 1 },
  { zhi: '未', row: 0, col: 2 },
  { zhi: '申', row: 0, col: 3 },
  { zhi: '辰', row: 1, col: 0 },
  { zhi: '酉', row: 1, col: 3 },
  { zhi: '卯', row: 2, col: 0 },
  { zhi: '戌', row: 2, col: 3 },
  { zhi: '寅', row: 3, col: 0 },
  { zhi: '丑', row: 3, col: 1 },
  { zhi: '子', row: 3, col: 2 },
  { zhi: '亥', row: 3, col: 3 },
];

// ============ 算法 ============

// 五虎遁：从寅宫起天干
function calculateGongGan(yearGan: string, gongZhiIdx: number): string {
  const wuhuStart: Record<string, number> = {
    '甲': 2, '己': 2, // 甲己年 → 寅宫起丙
    '乙': 4, '庚': 4, // 乙庚年 → 寅宫起戊
    '丙': 6, '辛': 6, // 丙辛年 → 寅宫起庚
    '丁': 8, '壬': 8, // 丁壬年 → 寅宫起壬
    '戊': 0, '癸': 0, // 戊癸年 → 寅宫起甲
  };
  const startGanIdx = wuhuStart[yearGan] ?? 0;
  const gongGanIdx = (startGanIdx + gongZhiIdx - 2 + 10) % 10;
  return GAN_NAMES[gongGanIdx];
}

// 命宫地支：寅宫起正月，顺数至生月，再逆数至生时
function calculateMingGongIdx(lunarMonth: number, hourZhiIdx: number): number {
  return (2 + (lunarMonth - 1) - hourZhiIdx + 24) % 12;
}

// 身宫地支：寅宫起正月，顺数至生月，再顺数至生时
function calculateShenGongIdx(lunarMonth: number, hourZhiIdx: number): number {
  return (2 + (lunarMonth - 1) + hourZhiIdx) % 12;
}

// 纳音五行局
function calculateWuxingJu(mingGan: string, mingZhi: string): string {
  const nayinWuxing: Record<string, string> = {
    '甲子': '金', '乙丑': '金', '丙寅': '火', '丁卯': '火', '戊辰': '木', '己巳': '木',
    '庚午': '土', '辛未': '土', '壬申': '金', '癸酉': '金', '甲戌': '火', '乙亥': '火',
    '丙子': '水', '丁丑': '水', '戊寅': '土', '己卯': '土', '庚辰': '金', '辛巳': '金',
    '壬午': '木', '癸未': '木', '甲申': '水', '乙酉': '水', '丙戌': '土', '丁亥': '土',
    '戊子': '火', '己丑': '火', '庚寅': '木', '辛卯': '木', '壬辰': '水', '癸巳': '水',
    '甲午': '金', '乙未': '金', '丙申': '火', '丁酉': '火', '戊戌': '木', '己亥': '木',
    '庚子': '土', '辛丑': '土', '壬寅': '金', '癸卯': '金', '甲辰': '火', '乙巳': '火',
    '丙午': '水', '丁未': '水', '戊申': '土', '己酉': '土', '庚戌': '金', '辛亥': '金',
    '壬子': '木', '癸丑': '木', '甲寅': '水', '乙卯': '水', '丙辰': '土', '丁巳': '土',
    '戊午': '火', '己未': '火', '庚申': '木', '辛酉': '木', '壬戌': '水', '癸亥': '水',
  };
  const ganZhi = mingGan + mingZhi;
  const wuxing = nayinWuxing[ganZhi] || '水';
  const juMap: Record<string, string> = {
    '水': '水二局', '木': '木三局', '金': '金四局', '土': '土五局', '火': '火六局'
  };
  return juMap[wuxing] || '水二局';
}

// 紫微星位置：起紫微星诀算法
// 口诀：「六五四三二，酉午亥辰丑，局数除日数，商数宫前走；
//         若见数无余，便要起虎口，日数小於局，还直宫中守。」
// 算法：日数+offset使能被局数整除，商为步数，offset奇偶定进退
// 偶顺逆奇：循环次数为偶数则顺加，奇数则逆减
function calculateZiWeiPosition(day: number, ju: number): number {
  const d = Math.min(Math.max(day, 1), 30);
  let offset = -1;
  let quotient = 0;
  let remainder: number;

  do {
    offset++;
    const divisor = d + offset;
    quotient = Math.floor(divisor / ju);
    remainder = divisor % ju;
  } while (remainder !== 0);

  // 商数取模12，从寅宫(iztro坐标系0)起算
  quotient = quotient % 12;
  // 从寅宫起，走(quotient-1)步
  let ziweiIdx = (quotient - 1 + 12) % 12;
  // offset奇数→逆减offset步，offset偶数→顺加offset步
  if (offset % 2 === 1) {
    // 奇数逆减
    ziweiIdx = (ziweiIdx - offset + 12) % 12;
  } else {
    // 偶数顺加
    ziweiIdx = (ziweiIdx + offset + 12) % 12;
  }
  // 归一化到0-11
  ziweiIdx = ((ziweiIdx % 12) + 12) % 12;
  // 转换到我们的坐标系(子=0): iztro坐标系(寅=0) + 2 = 我们的坐标系(寅=2)
  return (ziweiIdx + 2) % 12;
}

// 钦天门飞星派天府星位置：紫微+天府=4（以寅卯之间为轴心对称）
// 紫微子(0)↔天府辰(4), 紫微丑(1)↔天府卯(3), 紫微寅(2)↔天府寅(2)(紫府同宫), ...
// 公式: 天府 = (4 - 紫微 + 12) % 12
function calculateTianFuPosition(ziWeiPos: number): number {
  return (4 - ziWeiPos + 12) % 12;
}

// 文昌星：从戌宫起，按时支逆数
function calculateWenChangPos(hourZhiIdx: number): number {
  return (10 - hourZhiIdx + 12) % 12;
}

// 文曲星：从辰宫起，按时支顺数
function calculateWenQuPos(hourZhiIdx: number): number {
  return (4 + hourZhiIdx) % 12;
}

// 左辅星：从辰宫起，按月顺数
function calculateZuoFuPos(lunarMonth: number): number {
  return (4 + lunarMonth - 1) % 12;
}

// 右弼星：从戌宫起，按月逆数
function calculateYouBiPos(lunarMonth: number): number {
  return (10 - lunarMonth + 1 + 12) % 12;
}

// 禄存星：按年干定位
// 甲→寅, 乙→卯, 丙→巳, 丁→午, 戊→巳, 己→午, 庚→申, 辛→酉, 壬→亥, 癸→子
function calculateLuCunPos(yearGan: string): number {
  const lucunMap: Record<string, number> = {
    '甲': 2, '乙': 3, '丙': 5, '丁': 6, '戊': 5,
    '己': 6, '庚': 8, '辛': 9, '壬': 11, '癸': 0
  };
  return lucunMap[yearGan] ?? 0;
}

// 擎羊星：禄存顺时针下一宫
function calculateQingYangPos(luCunPos: number): number {
  return (luCunPos + 1) % 12;
}

// 陀罗星：禄存逆时针下一宫
function calculateTuoLuoPos(luCunPos: number): number {
  return (luCunPos - 1 + 12) % 12;
}

// 天马星：按年支定位
// 子→寅, 丑→亥, 寅→申, 卯→巳, 辰→寅, 巳→亥, 午→申, 未→巳, 申→寅, 酉→亥, 戌→申, 亥→巳
function calculateTianMaPos(yearZhi: string): number {
  const zhiIdx = ZHI_NAMES.indexOf(yearZhi);
  // 申子辰→寅, 亥卯未→巳, 寅午戌→申, 巳酉丑→亥
  const tianmaMap: Record<number, number> = {
    0: 2, 1: 11, 2: 8, 3: 5, 4: 2, 5: 11,
    6: 8, 7: 5, 8: 2, 9: 11, 10: 8, 11: 5
  };
  return tianmaMap[zhiIdx] ?? 2;
}

// 火星：按年支和时支定位
function calculateHuoXingPos(yearZhi: string, hourZhiIdx: number): number {
  const zhiIdx = ZHI_NAMES.indexOf(yearZhi);
  // 火星起宫表：按年支分组
  // 寅午戌组：从丑起顺数时支; 申子辰组：从寅起顺数; 巳酉丑组：从卯起; 亥卯未组：从酉起
  let startPos: number;
  if ([2, 6, 10].includes(zhiIdx)) startPos = 1; // 寅午戌→丑
  else if ([0, 4, 8].includes(zhiIdx)) startPos = 2; // 申子辰→寅
  else if ([1, 5, 9].includes(zhiIdx)) startPos = 3; // 巳酉丑→卯
  else startPos = 9; // 亥卯未→酉
  return (startPos + hourZhiIdx) % 12;
}

// 铃星：按年支和时支定位
function calculateLingXingPos(yearZhi: string, hourZhiIdx: number): number {
  const zhiIdx = ZHI_NAMES.indexOf(yearZhi);
  // 铃星起宫表
  // 寅午戌组：从卯起顺数时支; 申子辰组：从戌起顺数; 巳酉丑组：从戌起; 亥卯未组：从戌起
  let startPos: number;
  if ([2, 6, 10].includes(zhiIdx)) startPos = 3; // 寅午戌→卯
  else startPos = 10; // 其余→戌
  return (startPos + hourZhiIdx) % 12;
}

// 地空星：按时支定位（从亥宫起逆数）
function calculateDiKongPos(hourZhiIdx: number): number {
  return (11 - hourZhiIdx + 12) % 12;
}

// 地劫星：按时支定位（从亥宫起顺数）
function calculateDiJiePos(hourZhiIdx: number): number {
  return (11 + hourZhiIdx) % 12;
}

// 天魁星（昼贵人）：按年干定位
function calculateTianKuiPos(yearGan: string): number {
  const TIAN_KUI: Record<string, number> = {
    '甲': 1, '乙': 0, '丙': 11, '丁': 11, '戊': 1,
    '己': 0, '庚': 1, '辛': 6, '壬': 3, '癸': 3,
  };
  return TIAN_KUI[yearGan] ?? 0;
}

// 天钺星（夜贵人）：按年干定位
function calculateTianYuePos(yearGan: string): number {
  const TIAN_YUE: Record<string, number> = {
    '甲': 7, '乙': 8, '丙': 9, '丁': 9, '戊': 7,
    '己': 8, '庚': 7, '辛': 2, '壬': 5, '癸': 5,
  };
  return TIAN_YUE[yearGan] ?? 0;
}

// 宫干自化（含向心/离心判断）
// 离心自化: 本宫宫干 → 本宫星曜 → 标在本宫
// 向心自化: 对宫宫干 → 本宫星曜 → 标在本宫
function calculateZiHuaForAllStars(
  gongGan: string,
  stars: string[],
  _allGongData: Array<{ zhi: string; gan: string; gongName: string; stars: string[] }>,
  gongIdx: number,
  gongData: Array<{
    zhi: string; gan: string; gongName: string; stars: string[];
    siHua: string[]; ziHua: Array<{ type: string; star: string; direction: '向心' | '离心' }>;
  }>
): void {
  const DUI_GONG: Record<number, number> = { 0: 6, 1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5 };
  const duiGongIdx = DUI_GONG[gongIdx];
  const duiGong = gongData[duiGongIdx];

  // 离心自化: 本宫宫干 → 本宫星曜 → 标在本宫
  const siHua = SIHUA_TABLE[gongGan];
  if (siHua) {
    for (const star of stars) {
      let type = '';
      if (star === siHua.lu) type = '自化禄';
      else if (star === siHua.quan) type = '自化权';
      else if (star === siHua.ke) type = '自化科';
      else if (star === siHua.ji) type = '自化忌';
      if (type) {
        gongData[gongIdx].ziHua.push({ type, star, direction: '离心' });
      }
    }
  }

  // 向心自化: 对宫宫干 → 本宫星曜 → 标在本宫
  if (duiGong) {
    const duiSiHua = SIHUA_TABLE[duiGong.gan];
    if (duiSiHua) {
      for (const star of stars) {
        let type = '';
        if (star === duiSiHua.lu) type = '自化禄';
        else if (star === duiSiHua.quan) type = '自化权';
        else if (star === duiSiHua.ke) type = '自化科';
        else if (star === duiSiHua.ji) type = '自化忌';
        if (type) {
          gongData[gongIdx].ziHua.push({ type, star, direction: '向心' });
        }
      }
    }
  }
}

// ============ 主排盘函数 ============

function calculateZiWei(lunarMonth: number, lunarDay: number, yearGan: string, yearZhi: string, hourZhiIdx: number, gender: 'male' | 'female'): {
  gongData: Array<{
    zhi: string;
    gan: string;
    gongName: string;
    stars: string[];
    siHua: string[];
    ziHua: Array<{ type: string; star: string; direction: '向心' | '离心' }>;
  }>;
  siHuaYear: { lu: string; quan: string; ke: string; ji: string };
  mingGongIdx: number;
  shenGongIdx: number;
  wuxingJu: string;
  daYunList: Array<{
    age: number;
    ganZhi: string;
    gongIdx: number;
    siHua: { lu: string; quan: string; ke: string; ji: string };
  }>;
} {
  // 命宫身宫
  const mingGongIdx = calculateMingGongIdx(lunarMonth, hourZhiIdx);
  const shenGongIdx = calculateShenGongIdx(lunarMonth, hourZhiIdx);

  // 命宫天干
  const mingGan = calculateGongGan(yearGan, mingGongIdx);

  // 五行局
  const wuxingJu = calculateWuxingJu(mingGan, ZHI_NAMES[mingGongIdx]);
  const juNum = WUXING_JU[wuxingJu] || 2;

  // 紫微星和天府星位置
  const ziWeiPos = calculateZiWeiPosition(lunarDay, juNum);
  const tianFuPos = calculateTianFuPosition(ziWeiPos);
  
  // 调试输出（与iztro对照）
  if (typeof window !== 'undefined') {
    console.log(`[紫微斗数] 命宫: ${mingGan}${ZHI_NAMES[mingGongIdx]}(${GONG_NAMES[mingGongIdx]}), 五行局: ${wuxingJu}, 日: ${lunarDay}, 局数: ${juNum}`);
    console.log(`[紫微斗数] 紫微星: ${ZHI_NAMES[ziWeiPos]}宫, 天府星: ${ZHI_NAMES[tianFuPos]}宫`);
  }

  // 文昌文曲（按时支）
  const wenChangPos = calculateWenChangPos(hourZhiIdx);
  const wenQuPos = calculateWenQuPos(hourZhiIdx);

  // 左辅右弼（按月）
  const zuoFuPos = calculateZuoFuPos(lunarMonth);
  const youBiPos = calculateYouBiPos(lunarMonth);

  // 禄存擎羊陀罗（按年干）
  const luCunPos = calculateLuCunPos(yearGan);
  const qingYangPos = calculateQingYangPos(luCunPos);
  const tuoLuoPos = calculateTuoLuoPos(luCunPos);

  // 天马（按年支）
  const tianMaPos = calculateTianMaPos(yearZhi);

  // 火星铃星（按年支+时支）
  const huoXingPos = calculateHuoXingPos(yearZhi, hourZhiIdx);
  const lingXingPos = calculateLingXingPos(yearZhi, hourZhiIdx);

  // 地空地劫（按时支）
  const diKongPos = calculateDiKongPos(hourZhiIdx);
  const diJiePos = calculateDiJiePos(hourZhiIdx);

  // 天魁天钺（按年干）
  const tianKuiPos = calculateTianKuiPos(yearGan);
  const tianYuePos = calculateTianYuePos(yearGan);

  // 年干四化
  const siHuaYear = SIHUA_TABLE[yearGan] || { lu: '', quan: '', ke: '', ji: '' };

  // 构建十二宫数据
  const gongData: Array<{
    zhi: string;
    gan: string;
    gongName: string;
    stars: string[];
    siHua: string[];
    ziHua: Array<{ type: string; star: string; direction: '向心' | '离心' }>;
  }> = [];

  for (let i = 0; i < 12; i++) {
    const zhi = ZHI_NAMES[i];
    const gan = calculateGongGan(yearGan, i);
    const gongNameIdx = (mingGongIdx - i + 12) % 12;
    const gongName = GONG_NAMES[gongNameIdx];

    const stars: string[] = [];

    // 紫微星系（逆时针分布：从紫微位置逆时针偏移）
    for (const s of ZIWEI_SYSTEM_CCW) {
      const starPos = (ziWeiPos - s.offset + 12) % 12;
      if (i === starPos) {
        stars.push(s.star);
      }
    }

    // 天府星系（顺时针分布：从天府位置顺时针偏移）
    for (const s of TIANFU_SYSTEM_CW) {
      const starPos = (tianFuPos + s.offset) % 12;
      if (i === starPos) {
        stars.push(s.star);
      }
    }

    // 左辅右弼文昌文曲
    if (i === zuoFuPos) stars.push('左辅');
    if (i === youBiPos) stars.push('右弼');
    if (i === wenChangPos) stars.push('文昌');
    if (i === wenQuPos) stars.push('文曲');

    // 禄存擎羊陀罗
    if (i === luCunPos) stars.push('禄存');
    if (i === qingYangPos) stars.push('擎羊');
    if (i === tuoLuoPos) stars.push('陀罗');

    // 天马
    if (i === tianMaPos) stars.push('天马');

    // 火星铃星
    if (i === huoXingPos) stars.push('火星');
    if (i === lingXingPos) stars.push('铃星');

    // 地空地劫
    if (i === diKongPos) stars.push('地空');
    if (i === diJiePos) stars.push('地劫');

    // 天魁天钺
    if (i === tianKuiPos) stars.push('天魁');
    if (i === tianYuePos) stars.push('天钺');

    // 年干四化标记（与stars数组对齐，确保索引一致）
    const siHua: string[] = [];
    for (const star of stars) {
      let mark = '';
      if (star === siHuaYear.lu) mark = '禄';
      else if (star === siHuaYear.quan) mark = '权';
      else if (star === siHuaYear.ke) mark = '科';
      else if (star === siHuaYear.ji) mark = '忌';
      siHua.push(mark);
    }

    gongData.push({ zhi, gan, gongName, stars, siHua, ziHua: [] });
  }

  // 第二轮：计算自化（所有宫位创建完成后，才能正确获取对宫数据）
  for (let i = 0; i < 12; i++) {
    const gong = gongData[i];
    calculateZiHuaForAllStars(gong.gan, gong.stars, gongData, i, gongData);
  }

  // 大运
  const daYunList: Array<{
    age: number;
    ganZhi: string;
    gongIdx: number;
    siHua: { lu: string; quan: string; ke: string; ji: string };
  }> = [];

  const yangGan = ['甲', '丙', '戊', '庚', '壬'];
  const isYangGan = yangGan.includes(yearGan);
  const forward = (isYangGan && gender === 'male') || (!isYangGan && gender === 'female');
  const direction = forward ? 1 : -1;

  const yearGanIdx = GAN_NAMES.indexOf(yearGan);
  const yearZhiIdx = ZHI_INDEX[yearZhi] ?? 0;

  for (let d = 0; d < 8; d++) {
    const age = juNum + d * 10;
    const daYunGongIdx = (mingGongIdx + (d + 1) * direction + 120) % 12;
    // 大运干支 = 对应宫位的干支（宫位天干已由五虎遁排定）
    const daYunGan = gongData[daYunGongIdx].gan;
    const daYunZhi = gongData[daYunGongIdx].zhi;
    const ganZhi = daYunGan + daYunZhi;
    const daYunSiHua = SIHUA_TABLE[daYunGan] || { lu: '', quan: '', ke: '', ji: '' };
    daYunList.push({ age, ganZhi, gongIdx: daYunGongIdx, siHua: daYunSiHua });
  }

  return { gongData, siHuaYear, mingGongIdx, shenGongIdx, wuxingJu, daYunList };
}

// ============ 组件 ============

interface ZiweiChartProps {
  date: Date;
  gender: 'male' | 'female';
}

export default function ZiweiChart({ date, gender }: ZiweiChartProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<'benming' | 'dayun' | 'liunnian'>('benming');
  const [selectedDaYun, setSelectedDaYun] = useState(0);
  const [selectedLiuNianIdx, setSelectedLiuNianIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ziweiData = useMemo(() => {
    try {
      const solar = Solar.fromDate(date);
      const lunar = solar.getLunar();
      const eightChar = lunar.getEightChar();
      // 紫微斗数用农历年干支（以春节为界），不用八字年干支（以立春为界）
      const yearGanZhi = lunar.getYearInGanZhi();
      const yearGan = yearGanZhi[0];
      const yearZhi = yearGanZhi[1];
      // 晚子时(23:00-24:00)子初换日: 农历日期归属次日
      const isLateZiHour = solar.getHour() >= 23;
      const usedLunar = isLateZiHour
        ? Solar.fromDate(new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay() + 1, 0, 0, 0)).getLunar()
        : lunar;
      const lunarMonth = Math.abs(usedLunar.getMonth()); // 闰月取绝对值
      const lunarDay = usedLunar.getDay();
      const hourZhi = eightChar.getTimeZhi();
      const hourZhiIdx = ZHI_INDEX[hourZhi] ?? 0;
      return calculateZiWei(lunarMonth, lunarDay, yearGan, yearZhi, hourZhiIdx, gender);
    } catch {
      return null;
    }
  }, [date, gender]);

  useEffect(() => {
    if (isFullscreen && containerRef.current) {
      containerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isFullscreen]);

  if (!ziweiData) {
    return <div className="flex items-center justify-center h-64 text-[#d4c4f5]/50">计算中...</div>;
  }

  const { gongData, siHuaYear, mingGongIdx, shenGongIdx, wuxingJu, daYunList } = ziweiData;
  // 出生农历年份（流年计算基准年，晚子时归属次日）
  const birthSolar = Solar.fromDate(date);
  const birthLunar = (birthSolar.getHour() >= 23
    ? Solar.fromDate(new Date(birthSolar.getYear(), birthSolar.getMonth() - 1, birthSolar.getDay() + 1, 0, 0, 0)).getLunar()
    : birthSolar.getLunar());
  const birthYear = birthLunar.getYear();
  const currentYear = new Date().getFullYear();
  const currentYearGan = GAN_NAMES[(currentYear - 4) % 10];
  const currentYearSiHua = SIHUA_TABLE[currentYearGan] || { lu: '', quan: '', ke: '', ji: '' };
  const currentYearZhiIdx = (currentYear - 4) % 12;
  const currentDaYun = daYunList[selectedDaYun] || daYunList[0];

  // 四化颜色
  const siHuaColor = (type: string) => {
    switch (type) {
      case '禄': return 'text-green-400';
      case '权': return 'text-yellow-400';
      case '科': return 'text-blue-400';
      case '忌': return 'text-red-400';
      default: return 'text-[#d4c4f5]';
    }
  };

  // 自化颜色
  const ziHuaColor = (type: string) => {
    if (type.includes('禄')) return 'text-green-300';
    if (type.includes('权')) return 'text-yellow-300';
    if (type.includes('科')) return 'text-blue-300';
    if (type.includes('忌')) return 'text-red-300';
    return 'text-[#d4c4f5]';
  };

  // 判断是否为主星（14颗甲级主星）
  const isMainStar = (star: string) => {
    const mainStars = ['紫微','天机','太阳','武曲','天同','廉贞','天府','太阴','贪狼','巨门','天相','天梁','七杀','破军'];
    return mainStars.includes(star);
  };
  // 判断是否为甲级辅星（左右昌曲+其他辅星）
  const isMinorStar = (star: string) => {
    const minorStars = ['左辅','右弼','文昌','文曲','禄存','擎羊','陀罗','天马','火星','铃星','地空','地劫','天魁','天钺'];
    return minorStars.includes(star);
  };

  // 左右昌曲星
  const ZUO_YOU_CHANG_QU = ['左辅', '右弼', '文昌', '文曲'];

  const renderGong = (zhi: string, row: number, col: number, mode: 'benming' | 'dayun' | 'liunnian' = 'benming') => {
    const zhiIdx = ZHI_INDEX[zhi];
    const gong = gongData[zhiIdx];
    if (!gong) return null;

    const isMing = zhiIdx === mingGongIdx;
    const isShen = zhiIdx === shenGongIdx;
    const isDaYunGong = currentDaYun && zhiIdx === currentDaYun.gongIdx;
    const isLiuNianGong = zhiIdx === currentYearZhiIdx;

    // 大运四化标记（与stars数组对齐）
    const daYunSiHuaMarks: string[] = [];
    if (currentDaYun && mode === 'dayun') {
      for (const star of gong.stars) {
        let mark = '';
        if (star === currentDaYun.siHua.lu) mark = '禄';
        else if (star === currentDaYun.siHua.quan) mark = '权';
        else if (star === currentDaYun.siHua.ke) mark = '科';
        else if (star === currentDaYun.siHua.ji) mark = '忌';
        daYunSiHuaMarks.push(mark);
      }
    }

    // 流年四化标记（与stars数组对齐）
    const liuNianSiHuaMarks: string[] = [];
    if (mode === 'liunnian') {
      for (const star of gong.stars) {
        let mark = '';
        if (star === currentYearSiHua.lu) mark = '禄';
        else if (star === currentYearSiHua.quan) mark = '权';
        else if (star === currentYearSiHua.ke) mark = '科';
        else if (star === currentYearSiHua.ji) mark = '忌';
        liuNianSiHuaMarks.push(mark);
      }
    }

    return (
      <div
        key={zhi}
        className={cn(
          'border border-[#d4c4f5]/20 relative flex flex-col p-1',
          isMing && 'ring-1 ring-[#d4c4f5]/50',
          isDaYunGong && mode === 'dayun' && 'ring-1 ring-[#f5e6a3]/50',
          isLiuNianGong && mode === 'liunnian' && 'ring-1 ring-[#a8d5a2]/50',
        )}
        style={{ gridRow: row + 1, gridColumn: col + 1, minHeight: '110px' }}
      >
        {/* 宫干+地支 */}
        <div className="flex items-center justify-between text-[13px] mb-0.5">
          <span className="text-[#f5e6a3] font-bold">{gong.gan}{zhi}</span>
          <span className={cn(
            'text-[12px] px-0.5 rounded',
            isMing ? 'bg-[#d4c4f5]/30 text-[#d4c4f5]' : 'text-[#d4c4f5]/70'
          )}>
            {gong.gongName}
            {isShen && <span className="text-[#f5e6a3] ml-0.5">身</span>}
          </span>
        </div>

        {/* 主星（14颗甲级主星） */}
        <div className="flex-1 grid grid-cols-3 gap-x-1 gap-y-px">
          {gong.stars.filter(isMainStar).map((star, idx) => {
            const _oi = gong.stars.indexOf(star);
            const siHuaMark = gong.siHua[_oi];
            const daYunMark = daYunSiHuaMarks[_oi];
            const liuNianMark = liuNianSiHuaMarks[_oi];
            return (
              <div key={`${star}-${idx}`} className="flex items-center gap-0.5 text-[14px] leading-tight">
                <span className="text-[#f5e6a3]">{star}</span>
                {siHuaMark && <span className={cn('text-[12px]', siHuaColor(siHuaMark))}>{siHuaMark}</span>}
                {daYunMark && <span className={cn('text-[12px] opacity-70', siHuaColor(daYunMark))}>大{daYunMark}</span>}
                {liuNianMark && <span className={cn('text-[12px] opacity-70', siHuaColor(liuNianMark))}>流{liuNianMark}</span>}
              </div>
            );
          })}
        </div>

        {/* 辅星（甲级辅星） */}
        <div className="flex-1 grid grid-cols-3 gap-x-1 gap-y-px">
          {gong.stars.filter(isMinorStar).map((star, idx) => {
            const _oi = gong.stars.indexOf(star);
            const siHuaMark = gong.siHua[_oi];
            const daYunMark = daYunSiHuaMarks[_oi];
            const liuNianMark = liuNianSiHuaMarks[_oi];
            return (
              <div key={`${star}-${idx}`} className="flex items-center gap-0.5 text-[12px] leading-tight">
                <span className="text-[#d4c4f5]/80">{star}</span>
                {siHuaMark && <span className={cn('text-[11px]', siHuaColor(siHuaMark))}>{siHuaMark}</span>}
                {daYunMark && <span className={cn('text-[11px] opacity-70', siHuaColor(daYunMark))}>大{daYunMark}</span>}
                {liuNianMark && <span className={cn('text-[11px] opacity-70', siHuaColor(liuNianMark))}>流{liuNianMark}</span>}
              </div>
            );
          })}
        </div>

        {/* 自化 */}
        {gong.ziHua.length > 0 && (
          <div className="flex flex-wrap gap-x-1 text-[12px]">
            {gong.ziHua.map((zh, idx) => (
              <span key={`zh-${idx}`} className={cn('opacity-80', ziHuaColor(zh.type))}>
                {zh.type.replace('自化', '')}
                {zh.direction === '向心' ? '（向）' : '（离）'}
              </span>
            ))}
          </div>
        )}

        {/* 大运/流年宫位标记 */}
        {isDaYunGong && mode === 'dayun' && (
          <div className="absolute top-0 right-0 text-[14px] bg-[#f5e6a3]/20 text-[#f5e6a3] px-1 rounded-bl">大运</div>
        )}
        {isLiuNianGong && mode === 'liunnian' && (
          <div className="absolute top-0 right-0 text-[14px] bg-[#a8d5a2]/20 text-[#a8d5a2] px-1 rounded-bl">流年</div>
        )}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={cn(
      'rounded-lg border border-[#d4c4f5]/20 bg-[#1a1a1a]/90',
      isFullscreen && 'fixed inset-0 z-50 rounded-none overflow-auto p-4'
    )}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-2 border-b border-[#d4c4f5]/10">
        <h3 className="text-sm font-bold text-[#d4c4f5]">紫微斗数</h3>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-[#d4c4f5]/60 hover:text-[#d4c4f5]">
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* 大运选择 */}
      {daYunList.length > 0 && (
        <div className="flex gap-1 px-2 py-1 overflow-x-auto border-b border-[#d4c4f5]/10">
          <button
            onClick={() => setViewMode('benming')}
            className={cn(
              'text-[12px] px-1.5 py-0.5 rounded whitespace-nowrap',
              viewMode === 'benming' ? 'bg-white/20 text-white' : 'text-[#d4c4f5]/50 hover:text-[#d4c4f5]/80'
            )}
          >本命</button>
          <span className="text-[12px] text-[#d4c4f5]/60 mr-1 whitespace-nowrap">大运</span>
          {daYunList.map((dy, idx) => (
            <button
              key={`dy-${idx}`}
              className={cn(
                'text-[12px] px-1.5 py-0.5 rounded whitespace-nowrap',
                selectedDaYun === idx ? 'bg-[#f5e6a3]/20 text-[#f5e6a3]' : 'text-[#d4c4f5]/50 hover:text-[#d4c4f5]/80'
              )}
              onClick={() => { setSelectedDaYun(idx); setSelectedLiuNianIdx(0); setViewMode('dayun'); }}
            >
              {dy.ganZhi}({dy.age}~{dy.age+9}岁)
            </button>
          ))}
        </div>
      )}

      {/* 流年选择 */}
      {daYunList.length > 0 && (
        <div className="flex gap-1 px-2 py-1 overflow-x-auto border-b border-[#d4c4f5]/10">
          <span className="text-[12px] text-[#d4c4f5]/60 mr-1 whitespace-nowrap">流年</span>
          {(() => {
            const dy = daYunList[selectedDaYun];
            const years = [];
            for (let i = 0; i < 10; i++) {
              years.push(dy.age + i);
            }
            return years.map((age, idx) => {
              const year = birthYear + age - 1;
              const gan = GAN_NAMES[(year - 4) % 10] + ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][(year - 4) % 12];
              return (
                <button
                  key={`ln-${idx}`}
                  className={cn(
                    'text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap',
                    selectedLiuNianIdx === idx ? 'bg-[#a8d5a2]/20 text-[#a8d5a2]' : 'text-[#d4c4f5]/50 hover:text-[#d4c4f5]/80'
                  )}
                  onClick={() => { setSelectedLiuNianIdx(idx); setViewMode('liunnian'); }}
                >
                  {gan}({year})
                </button>
              );
            });
          })()}
        </div>
      )}

      {/* 紫微十二宫盘（本命为底，大运/流年叠加） */}
      <div className="p-2">
        <div className="relative grid grid-cols-4 grid-rows-4 gap-px">
          {GONG_LAYOUT.map(({ zhi, row, col }) => renderGong(zhi, row, col, viewMode))}
        </div>
      </div>

      {/* 四化说明 */}
      <div className="px-2 pb-2 flex flex-wrap gap-2 text-[12px] text-[#d4c4f5]/60">
        <span>年四化：</span>
        <span className={siHuaColor('禄')}>{siHuaYear.lu}禄</span>
        <span className={siHuaColor('权')}>{siHuaYear.quan}权</span>
        <span className={siHuaColor('科')}>{siHuaYear.ke}科</span>
        <span className={siHuaColor('忌')}>{siHuaYear.ji}忌</span>
      </div>
    </div>
  );
}
