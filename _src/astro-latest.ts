// 西方占星计算库 - 简化VSOP87模型
// 参考宫神星网风格排盘

// ============ 常量定义 ============

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// 黄赤交角（J2000.0）
const OBLIQUITY_J2000 = 23.4392911;

// 行星ID
export const PLANET_SUN = 0;
export const PLANET_MOON = 1;
export const PLANET_MERCURY = 2;
export const PLANET_VENUS = 3;
export const PLANET_MARS = 4;
export const PLANET_JUPITER = 5;
export const PLANET_SATURN = 6;
export const PLANET_URANUS = 7;
export const PLANET_NEPTUNE = 8;
export const PLANET_PLUTO = 9;

export const PLANET_NAMES: string[] = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export const PLANET_NAMES_CN: string[] = ['太阳', '月亮', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星'];
export const PLANET_SYMBOLS: string[] = ['☉', '☽', '☿', '♀', '♂', '♃', '♄', '♅', '♆', '♇'];

// 星座信息
export const ZODIAC_NAMES: string[] = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

export const ZODIAC_NAMES_CN: string[] = [
  '白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座',
  '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'
];

export const ZODIAC_SYMBOLS: string[] = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

// 相位类型
export interface Aspect {
  planet1: number;
  planet2: number;
  type: string;
  typeCN: string;
  orb: number;
  exact: number;
}

// 行星位置
export interface PlanetPosition {
  id: number;
  name: string;
  nameCN: string;
  symbol: string;
  longitude: number;
  latitude: number;
  speed: number;
  house: number;
  retrograde: boolean;
}

// 宫位信息
export interface HouseInfo {
  number: number;
  cusp: number;
  sign: string;
  signCN: string;
  signSymbol: string;
}

// 互容信息
export interface MutualReception {
  planet1: number;
  planet2: number;
  type: string;
  description: string;
}

// 接纳信息
export interface Reception {
  receivingPlanet: number;
  receivedPlanet: number;
  byDignity: string;
  description: string;
}

// 先天黄道得分
export interface EssentialDignityScore {
  planet: number;
  nameCN: string;
  sign: string;
  signCN: string;
  domicile: number;
  exaltation: number;
  triplicity: number;
  term: number;
  face: number;
  detriment: number;
  fall: number;
  total: number;
}

// 星盘数据
export interface NatalChartData {
  planets: PlanetPosition[];
  houses: HouseInfo[];
  ascendant: number;
  midheaven: number;
  aspects: Aspect[];
  mutualReceptions: MutualReception[];
  receptions: Reception[];
  essentialDignityScores: EssentialDignityScore[];
  mode: 'modern' | 'classical';
}

// ============ 核心计算 ============

// Julian Day Number (输入为本地时间，需转UTC)
// timezoneOffset: 本地时间与UTC的时差(小时)，北京时间=8
function toJD(year: number, month: number, day: number, hour: number, timezoneOffset: number = 8): number {
  // 将本地时间转为UTC: UTC = local - timezoneOffset
  let utcHour = hour - timezoneOffset;
  let utcDay = day;
  let utcMonth = month;
  let utcYear = year;

  if (utcHour < 0) {
    utcHour += 24;
    utcDay -= 1;
    if (utcDay < 1) {
      utcMonth -= 1;
      if (utcMonth < 1) {
        utcMonth = 12;
        utcYear -= 1;
      }
      // 获取上月天数
      const daysInMonth = new Date(utcYear, utcMonth, 0).getDate();
      utcDay = daysInMonth + utcDay;
    }
  } else if (utcHour >= 24) {
    utcHour -= 24;
    utcDay += 1;
    const daysInMonth = new Date(utcYear, utcMonth, 0).getDate();
    if (utcDay > daysInMonth) {
      utcDay = 1;
      utcMonth += 1;
      if (utcMonth > 12) {
        utcMonth = 1;
        utcYear += 1;
      }
    }
  }

  const y = utcMonth <= 2 ? utcYear - 1 : utcYear;
  const m = utcMonth <= 2 ? utcMonth + 12 : utcMonth;
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + utcDay + utcHour / 24 + B - 1524.5;
}

// Julian Century from J2000.0
function julianCentury(jd: number): number {
  return (jd - 2451545.0) / 36525.0;
}

// 真黄赤交角
function trueObliquity(T: number): number {
  return OBLIQUITY_J2000 + 0.00256 * Math.cos((125.0 - 1934.1 * T) * DEG_TO_RAD);
}

// 太阳黄经（高精度）
function calculateSunLongitude(T: number): number {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mrad = M * DEG_TO_RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);
  const sunLon = L0 + C;
  return ((sunLon % 360) + 360) % 360;
}

// 月亮黄经（高精度，含主要摄动项）
function calculateMoonLongitude(T: number): number {
  const Lp = 218.3165 + 481267.8813 * T;
  const M = 134.9634 + 477198.8676 * T;
  const F = 93.2721 + 483202.0175 * T;
  const D = 297.8502 + 445267.1115 * T;
  const Mrad = M * DEG_TO_RAD;
  const Frad = F * DEG_TO_RAD;
  const Drad = D * DEG_TO_RAD;

  const lon = Lp
    + 6.289 * Math.sin(Mrad)
    + 1.274 * Math.sin(2 * Drad - Mrad)
    + 0.658 * Math.sin(2 * Drad)
    + 0.214 * Math.sin(2 * Mrad)
    - 0.186 * Math.sin(Drad)
    - 0.114 * Math.sin(2 * Frad)
    - 0.059 * Math.sin(2 * Drad - 2 * Mrad)
    + 0.057 * Math.sin(2 * Drad - Mrad - Frad);

  return ((lon % 360) + 360) % 360;
}

// 行星参数表（J2000.0轨道根数）
const PLANET_PARAMS: Record<number, { L0: number; a: number; e: number; wBar: number; M0: number; n: number }> = {
  [PLANET_MERCURY]: { L0: 252.2509, a: 0.38710, e: 0.20563, wBar: 77.4561, M0: 174.796, n: 149472.674 },
  [PLANET_VENUS]:   { L0: 181.9798, a: 0.72333, e: 0.00677, wBar: 131.5637, M0: 50.416, n: 58517.816 },
  [PLANET_MARS]:    { L0: 355.4330, a: 1.52368, e: 0.09341, wBar: 336.0602, M0: 19.373, n: 19140.299 },
  [PLANET_JUPITER]: { L0: 34.3515,  a: 5.20260, e: 0.04849, wBar: 14.3312, M0: 20.020, n: 3034.906 },
  [PLANET_SATURN]:  { L0: 50.0774,  a: 9.55491, e: 0.05551, wBar: 93.0597, M0: 317.021, n: 1222.114 },
  [PLANET_URANUS]:  { L0: 314.0550, a: 19.2184, e: 0.04630, wBar: 171.1, M0: 142.239, n: 427.0 },
  [PLANET_NEPTUNE]: { L0: 304.3487, a: 30.1104, e: 0.00899, wBar: 48.1202, M0: 256.228, n: 218.459 },
  [PLANET_PLUTO]:   { L0: 238.9288, a: 39.4820, e: 0.24884, wBar: 224.0986, M0: 14.530, n: 145.175 },
};

// 求解开普勒方程: M = E - e*sin(E)
function solveKepler(M: number, e: number, iterations: number = 20): number {
  let E = M;
  for (let i = 0; i < iterations; i++) {
    const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

// 行星日心黄经
function calculateHeliocentricLongitude(planetId: number, T: number): { lon: number; r: number } {
  const p = PLANET_PARAMS[planetId];
  if (!p) return { lon: 0, r: 1 };

  // 平近点角
  const M = ((p.M0 + p.n * T) % 360 + 360) % 360;
  const Mrad = M * DEG_TO_RAD;

  // 开普勒方程求偏近点角
  const E = solveKepler(Mrad, p.e);

  // 真近点角
  const v = 2 * Math.atan2(
    Math.sqrt(1 + p.e) * Math.sin(E / 2),
    Math.sqrt(1 - p.e) * Math.cos(E / 2)
  ) * RAD_TO_DEG;

  // 日心黄经 = 近点辐角 + 真近点角
  const lon = ((v + p.wBar) % 360 + 360) % 360;

  // 日心距
  const r = p.a * (1 - p.e * Math.cos(E));

  return { lon, r };
}

// 地心黄经计算
function calculatePlanetLongitude(planetId: number, T: number): number {
  if (planetId === PLANET_SUN) return calculateSunLongitude(T);
  if (planetId === PLANET_MOON) return calculateMoonLongitude(T);

  const planet = calculateHeliocentricLongitude(planetId, T);
  const earthHelio = calculateHeliocentricLongitude_Sun(T);

  // 将日心坐标转换为地心黄经（笛卡尔坐标法）
  const r = planet.r; // 行星到太阳
  const R = earthHelio.r; // 地球到太阳

  // 行星日心直角坐标
  const xp = r * Math.cos(planet.lon * DEG_TO_RAD);
  const yp = r * Math.sin(planet.lon * DEG_TO_RAD);
  // 地球日心直角坐标
  const xe = R * Math.cos(earthHelio.lon * DEG_TO_RAD);
  const ye = R * Math.sin(earthHelio.lon * DEG_TO_RAD);
  // 行星地心直角坐标 = 行星日心 - 地球日心
  const xg = xp - xe;
  const yg = yp - ye;
  // 地心黄经
  const geoLon = Math.atan2(yg, xg) * RAD_TO_DEG;
  return ((geoLon % 360) + 360) % 360;
}

// 地球日心坐标（用于地心转换）
function calculateHeliocentricLongitude_Sun(T: number): { lon: number; r: number } {
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mrad = M * DEG_TO_RAD;
  const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mrad)
    + (0.019993 - 0.000101 * T) * Math.sin(2 * Mrad)
    + 0.000289 * Math.sin(3 * Mrad);

  const sunGeoLon = ((L0 + C) % 360 + 360) % 360;
  const earthHelioLon = (sunGeoLon + 180) % 360;

  // 地球到太阳距离（简化）
  const e = 0.01671 - 0.000042 * T;
  const E = solveKepler(Mrad, e);
  const r = 1.000001018 * (1 - e * Math.cos(E));

  return { lon: earthHelioLon, r };
}

// 行星逆行判断
function isPlanetRetrograde(planetId: number, year: number, month: number, day: number, hour: number, minute: number): boolean {
  if (planetId === PLANET_SUN || planetId === PLANET_MOON) return false;

  const jd1 = toJD(year, month, day, hour + minute / 60);
  const T1 = julianCentury(jd1);
  const lon1 = calculatePlanetLongitude(planetId, T1);

  const jd2 = jd1 + 1;
  const T2 = julianCentury(jd2);
  const lon2 = calculatePlanetLongitude(planetId, T2);

  let diff = lon2 - lon1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return diff < 0;
}

// ============ MC / ASC / 宫位计算 ============

// 计算当地恒星时 (LST)
function calculateLST(jd: number, T: number, longitudeDeg: number): number {
  // GMST (Greenwich Mean Sidereal Time) in degrees
  const GMST = 280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T
    - T * T * T / 38710000;

  // LST = GMST + 经度
  const LST = ((GMST + longitudeDeg) % 360 + 360) % 360;
  return LST;
}

// MC (中天/天顶) 从RAMC计算
function calculateMCFromRAMC(RAMC: number, eps: number): number {
  const ramcRad = RAMC * DEG_TO_RAD;
  const epsRad = eps * DEG_TO_RAD;

  let mc = Math.atan2(Math.sin(ramcRad), Math.cos(ramcRad) * Math.cos(epsRad)) * RAD_TO_DEG;
  if (mc < 0) mc += 360;
  return mc;
}

// ASC (上升点) 从RAMC计算
function calculateASCFromRAMC(RAMC: number, eps: number, latitude: number): number {
  const ramcRad = RAMC * DEG_TO_RAD;
  const epsRad = eps * DEG_TO_RAD;
  const latRad = latitude * DEG_TO_RAD;

  let asc = Math.atan2(
    Math.sin(epsRad) * Math.tan(latRad) + Math.cos(epsRad) * Math.sin(ramcRad),
    -Math.cos(ramcRad)
  ) * RAD_TO_DEG;

  if (asc < 0) asc += 360;
  return asc;
}

// Placidus分宫制 - 标准迭代算法
// 整宫制 (Whole Sign Houses): 每宫=ASC所在星座开始的30°
export function calculateWholeSignHouses(
  ascendant: number,
): number[] {
  const ascSignStart = Math.floor(((ascendant % 360) + 360) % 360 / 30) * 30;
  const houses: number[] = new Array(12);
  for (let i = 0; i < 12; i++) {
    houses[i] = (ascSignStart + i * 30) % 360;
  }
  return houses;
}

export function calculateHouses(
  _ascendant: number, // 忽略，重新计算
  latitude: number,
  year: number,
  month: number,
  day: number,
  hour: number,
  longitudeDeg: number = 116.4 // 默认北京经度
): number[] {
  const jd = toJD(year, month, day, hour);
  const T = julianCentury(jd);
  const eps = trueObliquity(T);

  // 计算LST和RAMC
  const LST = calculateLST(jd, T, longitudeDeg);
  const RAMC = LST; // RAMC = LST (in degrees)

  // MC和ASC
  const mc = calculateMCFromRAMC(RAMC, eps);
  const asc = calculateASCFromRAMC(RAMC, eps, latitude);

  const houses: number[] = new Array(12);
  houses[0] = asc;   // 1宫 = ASC
  houses[9] = mc;    // 10宫 = MC

  const latRad = latitude * DEG_TO_RAD;
  const epsRad = eps * DEG_TO_RAD;

  // 辅助：从赤经计算黄经
  function raToLon(raDeg: number): number {
    const raRad = raDeg * DEG_TO_RAD;
    let lon = Math.atan2(Math.sin(raRad), Math.cos(raRad) * Math.cos(epsRad)) * RAD_TO_DEG;
    if (lon < 0) lon += 360;
    return lon;
  }

  // 辅助：从黄经计算赤经和赤纬
  function lonToRaDec(lonDeg: number): { ra: number; dec: number } {
    const lonRad = lonDeg * DEG_TO_RAD;
    const ra = Math.atan2(Math.sin(lonRad) * Math.cos(epsRad), Math.cos(lonRad)) * RAD_TO_DEG;
    const dec = Math.asin(Math.sin(lonRad) * Math.sin(epsRad)) * RAD_TO_DEG;
    return { ra: ((ra % 360) + 360) % 360, dec };
  }

  // 辅助：计算半周日弧 (Semi-Diurnal Arc)
  function semiDiurnalArc(decDeg: number): number {
    const decRad = decDeg * DEG_TO_RAD;
    const cosSA = -Math.tan(latRad) * Math.tan(decRad);
    if (cosSA < -1) return 180; // 不落星
    if (cosSA > 1) return 0;   // 不升星
    return Math.acos(cosSA) * RAD_TO_DEG;
  }

  // Placidus宫位迭代计算
  // 
  // 标准Placidus定义（通过时角）：
  // 对于上半球宫位（MC到ASC之间，日间弧）：
  //   11宫: 该点自上升后已完成2/3的DSA，还剩1/3到MC
  //         H = -(1/3)*DSA → RA = RAMC + (1/3)*DSA
  //   12宫: 该点自上升后已完成1/3的DSA，还剩2/3到MC
  //         H = -(2/3)*DSA → RA = RAMC + (2/3)*DSA
  //
  // 对于下半球宫位（ASC到IC之间，夜间弧后半段）：
  //   2宫:  从IC到上升，已完成2/3（更靠近ASC）
  //         H = 180° + (2/3)*(180°-DSA) = 300° - (2/3)*DSA
  //         RA = RAMC - 300° + (2/3)*DSA
  //   3宫:  从IC到上升，已完成1/3（更靠近IC）
  //         H = 180° + (1/3)*(180°-DSA) = 240° - (1/3)*DSA
  //         RA = RAMC - 240° + (1/3)*DSA

  function computeHouse(targetRA: number, initialGuess: number): number {
    let lonGuess = initialGuess;
    for (let iter = 0; iter < 30; iter++) {
      const { dec } = lonToRaDec(lonGuess);
      const sda = semiDiurnalArc(dec);
      // 重新计算targetRA（因为DSA依赖于当前猜测的赤纬）
      // 上层函数会传入完整公式
      const newLon = raToLon(targetRA);
      if (Math.abs(newLon - lonGuess) < 0.0001 || Math.abs(newLon - lonGuess - 360) < 0.0001 || Math.abs(newLon - lonGuess + 360) < 0.0001) {
        return newLon;
      }
      lonGuess = newLon;
    }
    return lonGuess;
  }

  // 迭代计算：初始猜测 → 计算DSA → 得到目标RA → 转换为黄经 → 重新计算DSA → ...
  function iterateHouse(getTargetRA: (dsa: number) => number, initialGuess: number): number {
    let lonGuess = initialGuess;
    for (let iter = 0; iter < 30; iter++) {
      const { dec } = lonToRaDec(lonGuess);
      const sda = semiDiurnalArc(dec);
      const targetRA = getTargetRA(sda);
      const newLon = raToLon(targetRA);
      const diff = Math.abs(newLon - lonGuess);
      if (diff < 0.0001 || Math.abs(diff - 360) < 0.0001) {
        return newLon;
      }
      lonGuess = newLon;
    }
    return lonGuess;
  }

  // 11宫: RA = RAMC + (1/3)*DSA (1/3 of DSA from MC toward ASC)
  houses[10] = iterateHouse(
    (d) => ((RAMC + (1 / 3) * d) % 360 + 360) % 360,
    mc
  );

  // 12宫: RA = RAMC + (2/3)*DSA (2/3 of DSA from MC toward ASC)
  houses[11] = iterateHouse(
    (d) => ((RAMC + (2 / 3) * d) % 360 + 360) % 360,
    asc
  );

  // 2宫: RA = RAMC + 60° + (2/3)*DSA (2/3 from IC toward ASC, closer to ASC)
  const icLon = (mc + 180) % 360;
  houses[1] = iterateHouse(
    (d) => ((RAMC + 60 + (2 / 3) * d) % 360 + 360) % 360,
    (asc + 30) % 360
  );

  // 3宫: RA = RAMC + 120° + (1/3)*DSA (1/3 from IC toward ASC, closer to IC)
  houses[2] = iterateHouse(
    (d) => ((RAMC + 120 + (1 / 3) * d) % 360 + 360) % 360,
    (icLon + 330) % 360
  );

  // 4宫 = IC
  houses[3] = icLon;

  // 5宫 = 11宫 + 180°
  houses[4] = (houses[10] + 180) % 360;

  // 6宫 = 12宫 + 180°
  houses[5] = (houses[11] + 180) % 360;

  // 7宫 = DESC
  houses[6] = (asc + 180) % 360;

  // 8宫 = 2宫 + 180°
  houses[7] = (houses[1] + 180) % 360;

  // 9宫 = 3宫 + 180°
  houses[8] = (houses[2] + 180) % 360;

  return houses;
}

// 行星所在宫位
function findPlanetHouse(planetLon: number, houses: number[]): number {
  const lon = ((planetLon % 360) + 360) % 360;

  // 找到行星所在的宫位：行星黄经在哪个宫头和下一个宫头之间
  for (let i = 0; i < 12; i++) {
    const cusp = ((houses[i] % 360) + 360) % 360;
    const nextCusp = ((houses[(i + 1) % 12] % 360) + 360) % 360;

    // 判断lon是否在cusp到nextCusp的弧度内
    const diff = (lon - cusp + 360) % 360;
    let arc = (nextCusp - cusp + 360) % 360;

    // 处理跨越0度的情况
    if (arc < 1) arc = 30; // 防止除零

    if (diff < arc) {
      return i + 1; // 宫位1-12
    }
  }
  return 1;
}

// 计算行星位置
export function calculatePlanetaryPosition(
  planetId: number,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): PlanetPosition {
  const jd = toJD(year, month, day, hour + minute / 60);
  const T = julianCentury(jd);

  let longitude: number;
  let speed: number;

  if (planetId === PLANET_SUN) {
    longitude = calculateSunLongitude(T);
    speed = 0.9856;
  } else if (planetId === PLANET_MOON) {
    longitude = calculateMoonLongitude(T);
    speed = 13.176;
  } else {
    longitude = calculatePlanetLongitude(planetId, T);
    const speeds: Record<number, number> = {
      [PLANET_MERCURY]: 4.092,
      [PLANET_VENUS]: 1.602,
      [PLANET_MARS]: 0.524,
      [PLANET_JUPITER]: 0.083,
      [PLANET_SATURN]: 0.034,
      [PLANET_URANUS]: 0.012,
      [PLANET_NEPTUNE]: 0.006,
      [PLANET_PLUTO]: 0.004,
    };
    speed = speeds[planetId] || 1;
  }

  // 确保经度在[0, 360)范围内
  longitude = ((longitude % 360) + 360) % 360;

  // 逆行判断
  const retrograde = isPlanetRetrograde(planetId, year, month, day, hour, minute);
  if (retrograde) speed = -Math.abs(speed);

  return {
    id: planetId,
    name: PLANET_NAMES[planetId],
    nameCN: PLANET_NAMES_CN[planetId],
    symbol: PLANET_SYMBOLS[planetId],
    longitude,
    latitude: 0,
    speed,
    house: 0,
    retrograde,
  };
}

// 计算相位
export function calculateAspects(planets: PlanetPosition[]): Aspect[] {
  const aspects: Aspect[] = [];
  const aspectTypes = [
    { angle: 0, name: 'Conjunction', nameCN: '合', orb: 8 },
    { angle: 60, name: 'Sextile', nameCN: '六合', orb: 6 },
    { angle: 90, name: 'Square', nameCN: '刑', orb: 7 },
    { angle: 120, name: 'Trine', nameCN: '拱', orb: 8 },
    { angle: 180, name: 'Opposition', nameCN: '冲', orb: 8 },
  ];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const diff = Math.abs(planets[i].longitude - planets[j].longitude);
      const angle = diff > 180 ? 360 - diff : diff;

      for (const at of aspectTypes) {
        const orb = Math.abs(angle - at.angle);
        if (orb <= at.orb) {
          aspects.push({
            planet1: planets[i].id,
            planet2: planets[j].id,
            type: at.name,
            typeCN: at.nameCN,
            orb: Math.round(orb * 10) / 10,
            exact: Math.round(angle * 10) / 10,
          });
        }
      }
    }
  }

  return aspects;
}

// 先天黄道得分表（古典占星标准）
const ESSENTIAL_DIGNITIES: Record<number, {
  domicile: number[];
  exaltation: number;
  detriment: number[];
  fall: number;
  triplicity: Record<string, number[]>;
  term: [number, number][];
  face: [number, number][];
}> = {
  [PLANET_SUN]: {
    domicile: [4], exaltation: 0, detriment: [10], fall: 6,
    triplicity: { fire: [4] },
    term: [[6, 0], [13, 0], [20, 0], [27, 0], [30, 0]],
    face: [[10, 0], [20, 0], [30, 0]],
  },
  [PLANET_MOON]: {
    domicile: [3], exaltation: 1, detriment: [9], fall: 7,
    triplicity: { water: [3] },
    term: [[12, 1], [21, 1], [30, 1]],
    face: [[10, 1], [20, 1], [30, 1]],
  },
  [PLANET_MERCURY]: {
    domicile: [2, 5], exaltation: 5, detriment: [8, 11], fall: 11,
    triplicity: { air: [2] },
    term: [[7, 2], [15, 2], [22, 2], [30, 2]],
    face: [[10, 2], [20, 2], [30, 2]],
  },
  [PLANET_VENUS]: {
    domicile: [1, 6], exaltation: 11, detriment: [7, 0], fall: 5,
    triplicity: { earth: [1] },
    term: [[8, 3], [15, 3], [22, 3], [30, 3]],
    face: [[10, 3], [20, 3], [30, 3]],
  },
  [PLANET_MARS]: {
    domicile: [0, 7], exaltation: 9, detriment: [6, 3], fall: 1,
    triplicity: { water: [4] },
    term: [[6, 4], [14, 4], [21, 4], [30, 4]],
    face: [[10, 4], [20, 4], [30, 4]],
  },
  [PLANET_JUPITER]: {
    domicile: [8, 11], exaltation: 2, detriment: [2, 5], fall: 8,
    triplicity: { fire: [5] },
    term: [[6, 5], [14, 5], [22, 5], [30, 5]],
    face: [[10, 5], [20, 5], [30, 5]],
  },
  [PLANET_SATURN]: {
    domicile: [9, 6], exaltation: 6, detriment: [3, 0], fall: 3,
    triplicity: { air: [6] },
    term: [[6, 6], [12, 6], [20, 6], [30, 6]],
    face: [[10, 6], [20, 6], [30, 6]],
  },
};

function calculateEssentialDignityScore(planetId: number, signIndex: number, degree: number): EssentialDignityScore {
  const result: EssentialDignityScore = {
    planet: planetId,
    nameCN: PLANET_NAMES_CN[planetId] || '',
    sign: signIndex >= 0 && signIndex < 12 ? ZODIAC_NAMES[signIndex] : '',
    signCN: signIndex >= 0 && signIndex < 12 ? ZODIAC_NAMES_CN[signIndex] : '',
    domicile: 0,
    exaltation: 0,
    triplicity: 0,
    term: 0,
    face: 0,
    detriment: 0,
    fall: 0,
    total: 0,
  };

  if (signIndex < 0 || signIndex >= 12) return result;

  const dignities = ESSENTIAL_DIGNITIES[planetId];
  if (!dignities) return result;

  let hasMajor = false;
  // 入庙 +5
  if (dignities.domicile.includes(signIndex)) {
    result.domicile = 5;
    hasMajor = true;
  }
  // 旺相（曜昇）+4
  if (dignities.exaltation === signIndex) {
    result.exaltation = 4;
    hasMajor = true;
  }
  // 落陷（失位）-5
  if (dignities.detriment.includes(signIndex)) {
    result.detriment = -5;
    hasMajor = true;
  }
  // 失地（落旺）-4
  if (dignities.fall === signIndex) {
    result.fall = -4;
    hasMajor = true;
  }
  const elements = ['fire', 'earth', 'air', 'water'];
  if (!hasMajor) {
    // 三分 +3
    const signElement = elements[Math.floor(signIndex / 3)];
    if (dignities.triplicity[signElement] && dignities.triplicity[signElement].includes(signIndex)) {
      result.triplicity = 3;
    }
    // 界 +2
    if (dignities.term.length > 0) {
      for (const [maxDeg] of dignities.term) {
        if (degree < maxDeg) {
          result.term = 2;
          break;
        }
      }
    }
    // 面 +1
    if (dignities.face.length > 0 && result.term === 0) {
      for (const [maxDeg] of dignities.face) {
        if (degree < maxDeg) {
          result.face = 1;
          break;
        }
      }
    }
  }
  result.total = result.domicile + result.exaltation + result.detriment + result.fall + result.triplicity + result.term + result.face;
  return result;
}

// 互容检测
export function calculateMutualReceptions(planets: PlanetPosition[]): MutualReception[] {
  const receptions: MutualReception[] = [];

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const p1 = planets[i];
      const p2 = planets[j];
      const d1 = ESSENTIAL_DIGNITIES[p1.id];
      const d2 = ESSENTIAL_DIGNITIES[p2.id];
      if (!d1 || !d2) continue;

      const sign1 = Math.floor(((p1.longitude % 360) + 360) % 360 / 30);
      const sign2 = Math.floor(((p2.longitude % 360) + 360) % 360 / 30);

      if (d1.domicile.includes(sign2) && d2.domicile.includes(sign1)) {
        receptions.push({
          planet1: p1.id,
          planet2: p2.id,
          type: 'domicile',
          description: `${p1.nameCN}在${ZODIAC_NAMES_CN[sign1]}与${p2.nameCN}在${ZODIAC_NAMES_CN[sign2]}互容（入庙）`,
        });
      }

      if (d1.exaltation === sign2 && d2.exaltation === sign1) {
        receptions.push({
          planet1: p1.id,
          planet2: p2.id,
          type: 'exaltation',
          description: `${p1.nameCN}在${ZODIAC_NAMES_CN[sign1]}与${p2.nameCN}在${ZODIAC_NAMES_CN[sign2]}互容（旺相）`,
        });
      }
    }
  }

  return receptions;
}

// 接纳检测
export function calculateReceptions(planets: PlanetPosition[]): Reception[] {
  const result: Reception[] = [];

  for (const planet of planets) {
    const signIndex = Math.floor(((planet.longitude % 360) + 360) % 360 / 30);
    if (signIndex < 0 || signIndex >= 12) continue;

    for (const otherPlanet of planets) {
      if (planet.id === otherPlanet.id) continue;
      const dignities = ESSENTIAL_DIGNITIES[otherPlanet.id];
      if (!dignities) continue;

      if (dignities.domicile.includes(signIndex)) {
        result.push({
          receivingPlanet: otherPlanet.id,
          receivedPlanet: planet.id,
          byDignity: 'domicile',
          description: `${otherPlanet.nameCN}接纳${planet.nameCN}（入庙）`,
        });
      }
      if (dignities.exaltation === signIndex) {
        result.push({
          receivingPlanet: otherPlanet.id,
          receivedPlanet: planet.id,
          byDignity: 'exaltation',
          description: `${otherPlanet.nameCN}接纳${planet.nameCN}（旺相）`,
        });
      }
    }
  }

  return result;
}

// 计算MC和ASC
export function calculateMCAndASC(
  year: number, month: number, day: number, hour: number, minute: number,
  latitude: number, longitudeDeg: number = 116.4
): { mc: number; asc: number } {
  const hourDecimal = hour + minute / 60;
  const jd = toJD(year, month, day, hourDecimal);
  const T = julianCentury(jd);
  const eps = trueObliquity(T);
  const LST = calculateLST(jd, T, longitudeDeg);
  const RAMC = LST;

  const mc = calculateMCFromRAMC(RAMC, eps);
  const asc = calculateASCFromRAMC(RAMC, eps, latitude);

  return { mc, asc };
}

// 计算完整星盘
export function calculateNatalChart(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  latitude: number,
  longitudeDeg: number,
  mode: 'modern' | 'classical' = 'modern',
  houseSystem: 'placidus' | 'whole-sign' = 'placidus'
): NatalChartData {
  try {
    const hourDecimal = hour + minute / 60;

    // 宫位
    let houseCusps: number[];
    // 先计算Placidus ASC（用于所有模式）
    const placidusCusps = calculateHouses(0, latitude, year, month, day, hourDecimal, longitudeDeg);
    const asc = placidusCusps[0];
    if (houseSystem === 'whole-sign') {
      // 整宫制：ASC所在星座=第1宫，后续星座依次
      houseCusps = calculateWholeSignHouses(asc);
    } else {
      houseCusps = placidusCusps;
    }

    // MC（整宫制下取第10宫cusp）
    const mc = houseCusps[9];

    // 行星
    const planetIds = mode === 'classical'
      ? [PLANET_SUN, PLANET_MOON, PLANET_MERCURY, PLANET_VENUS, PLANET_MARS, PLANET_JUPITER, PLANET_SATURN]
      : [PLANET_SUN, PLANET_MOON, PLANET_MERCURY, PLANET_VENUS, PLANET_MARS, PLANET_JUPITER, PLANET_SATURN, PLANET_URANUS, PLANET_NEPTUNE, PLANET_PLUTO];

    const planets: PlanetPosition[] = planetIds.map(id => {
      const pos = calculatePlanetaryPosition(id, year, month, day, hour, minute);
      pos.house = findPlanetHouse(pos.longitude, houseCusps);
      return pos;
    });

    // 宫位信息
    const houses: HouseInfo[] = houseCusps.map((cusp, i) => {
      const safeCusp = ((cusp % 360) + 360) % 360;
      const signIdx = Math.floor(safeCusp / 30);
      return {
        number: i + 1,
        cusp: safeCusp,
        sign: signIdx >= 0 && signIdx < 12 ? ZODIAC_NAMES[signIdx] : '',
        signCN: signIdx >= 0 && signIdx < 12 ? ZODIAC_NAMES_CN[signIdx] : '',
        signSymbol: signIdx >= 0 && signIdx < 12 ? ZODIAC_SYMBOLS[signIdx] : '',
      };
    });

    // 相位
    const aspects = calculateAspects(planets);

    // 互容
    const mutualReceptions = calculateMutualReceptions(planets);

    // 接纳
    const receptions = calculateReceptions(planets);

    // 先天黄道得分
    const essentialDignityScores: EssentialDignityScore[] = planets.map(p => {
      const safeLon = ((p.longitude % 360) + 360) % 360;
      const signIndex = Math.floor(safeLon / 30);
      const degree = safeLon % 30;
      return calculateEssentialDignityScore(p.id, signIndex, degree);
    });

    return {
      planets,
      houses,
      ascendant: asc,
      midheaven: mc,
      aspects,
      mutualReceptions,
      receptions,
      essentialDignityScores,
      mode,
    };
  } catch {
    return {
      planets: [],
      houses: [],
      ascendant: 0,
      midheaven: 0,
      aspects: [],
      mutualReceptions: [],
      receptions: [],
      essentialDignityScores: [],
      mode,
    };
  }
}
