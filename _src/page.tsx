'use client';

import { useState, useCallback, useEffect } from 'react';
import { BirthInput, BirthInfo } from '@/components/birth-input';
import { BaziChart } from '@/components/bazi-chart';
import ZiweiChart from '@/components/ziwei-chart';
import QimenChart from '@/components/qimen-chart';
import AstroChart from '@/components/astro-chart';
import { Solar } from 'lunar-javascript';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, GripVertical } from 'lucide-react';

// 全屏状态类型
type FullscreenType = 'bazi' | 'ziwei' | 'qimen' | 'astro' | null;

// 盘面类型
type ChartType = 'bazi' | 'ziwei' | 'qimen' | 'astro';

// 盘面名称映射
const CHART_NAMES: Record<ChartType, string> = {
  bazi: '四柱八字',
  ziwei: '紫微斗数',
  qimen: '奇门遁甲',
  astro: '西方占星',
};

export default function HomePage() {
  // 出生信息状态
  const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null);
  
  // 全屏状态
  const [fullscreen, setFullscreen] = useState<FullscreenType>(null);
  
  // 盘面顺序（可调换）
  const [chartOrder, setChartOrder] = useState<ChartType[]>(['bazi', 'ziwei', 'qimen', 'astro']);
  
  // 拖拽状态
  const [draggedChart, setDraggedChart] = useState<ChartType | null>(null);

  // 处理出生信息变化
  const handleBirthInfoChange = useCallback((info: BirthInfo) => {
    setBirthInfo(info);
  }, []);

  // 处理全屏变化
  const handleFullscreenChange = useCallback((type: FullscreenType) => {
    setFullscreen(type);
  }, []);
  
  // 交换两个盘面的位置
  const swapCharts = useCallback((index1: number, index2: number) => {
    if (index1 < 0 || index2 < 0 || index1 >= chartOrder.length || index2 >= chartOrder.length) return;
    const newOrder = [...chartOrder];
    [newOrder[index1], newOrder[index2]] = [newOrder[index2], newOrder[index1]];
    setChartOrder(newOrder);
  }, [chartOrder]);
  
  // 拖拽开始
  const handleDragStart = useCallback((chart: ChartType) => {
    setDraggedChart(chart);
  }, []);
  
  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    setDraggedChart(null);
  }, []);
  
  // 拖拽到目标位置
  const handleDrop = useCallback((targetIndex: number) => {
    if (!draggedChart) return;
    const sourceIndex = chartOrder.indexOf(draggedChart);
    if (sourceIndex !== -1 && sourceIndex !== targetIndex) {
      swapCharts(sourceIndex, targetIndex);
    }
    setDraggedChart(null);
  }, [draggedChart, chartOrder, swapCharts]);

  // 初始化默认出生信息（与 birth-input.tsx 默认值一致：1990-06-22 辰时 女命）
  useEffect(() => {
    const solar = Solar.fromYmdHms(1990, 6, 22, 7, 0, 0);
    const lunar = solar.getLunar();
    
    setBirthInfo({
      name: '',
      year: 1990,
      month: 6,
      day: 22,
      hour: 7,
      minute: 0,
      gender: 'female',
      solar,
      lunar,
    });
  }, []);
  
  // 渲染单个盘面
  const renderChart = (chartType: ChartType, index: number) => {
    if (!birthInfo) return null;
    
    const isDragging = draggedChart === chartType;
    
    const commonProps = {
      isFullscreen: fullscreen === chartType,
      onFullscreenChange: (is: boolean) => handleFullscreenChange(is ? chartType : null),
    };
    
    let chartComponent;
    switch (chartType) {
      case 'bazi':
        chartComponent = (
          <BaziChart
            solar={birthInfo.solar}
            lunar={birthInfo.lunar}
            gender={birthInfo.gender}
            {...commonProps}
          />
        );
        break;
      case 'ziwei':
        chartComponent = (
          <ZiweiChart
            date={new Date(birthInfo.solar.getYear(), birthInfo.solar.getMonth() - 1, birthInfo.solar.getDay(), birthInfo.solar.getHour(), birthInfo.solar.getMinute())}
            gender={birthInfo.gender}
          />
        );
        break;
      case 'qimen':
        chartComponent = (
          <QimenChart
            solar={birthInfo.solar}
            lunar={birthInfo.lunar}
            gender={birthInfo.gender}
            fourPillars={{
              year: birthInfo.lunar.getEightChar().getYear(),
              month: birthInfo.lunar.getEightChar().getMonth(),
              day: birthInfo.solar.getHour() >= 23
                ? Solar.fromDate(new Date(birthInfo.solar.getYear(), birthInfo.solar.getMonth() - 1, birthInfo.solar.getDay() + 1, 0, 0, 0)).getLunar().getEightChar().getDay()
                : birthInfo.lunar.getEightChar().getDay(),
              hour: birthInfo.lunar.getEightChar().getTime(),
            }}
            {...commonProps}
          />
        );
        break;
      case 'astro':
        chartComponent = (
          <AstroChart
            year={birthInfo.solar.getYear()}
            month={birthInfo.solar.getMonth()}
            day={birthInfo.solar.getDay()}
            hour={birthInfo.solar.getHour()}
            minute={birthInfo.solar.getMinute()}
            gender={birthInfo.gender}
            isFullscreen={fullscreen === 'astro'}
            onToggleFullscreen={() => setFullscreen(fullscreen === 'astro' ? null : 'astro')}
          />
        );
        break;
    }
    
    return (
      <div
        key={chartType}
        className={`relative ${isDragging ? 'opacity-50' : ''}`}
        draggable
        onDragStart={() => handleDragStart(chartType)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => handleDrop(index)}
      >
        {/* 拖拽手柄和调换按钮 */}
        <div className="absolute -top-2 -left-2 z-10 flex gap-1">
          <div className="bg-[#2a2624] border border-[#d4c4f5]/30 rounded px-1 py-0.5 cursor-grab text-[#d4c4f5]/50 hover:text-[#d4c4f5]">
            <GripVertical className="w-3 h-3" />
          </div>
        </div>
        {chartComponent}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#1a1a1a] text-[#fafaf9] relative overflow-hidden">
      {/* 传统纹饰背景 */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5L35 15L45 15L40 25L45 35L35 35L30 45L25 35L15 35L20 25L15 15L25 15L30 5Z' fill='none' stroke='%23d4c4f5' stroke-width='0.5'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        />
      </div>

      {/* 头部标题 */}
      <header className="relative bg-gradient-to-b from-[#2a2624] via-[#252220] to-[#1a1a1a] border-b border-[#d4c4f5]/20 py-6">
        {/* 装饰线条 */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4c4f5]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#f5e6a3]/20 to-transparent" />
        
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-4">
              {/* Logo装饰 */}
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#d4c4f5] to-[#a090c0] flex items-center justify-center shadow-lg shadow-[#d4c4f5]/20">
                  <span className="text-2xl text-[#1a1a1a] font-bold">天</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#f5e6a3] flex items-center justify-center">
                  <span className="text-xs text-[#1a1a1a]">自</span>
                </div>
              </div>
              
              {/* 标题 */}
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-wider">
                  <span className="text-[#d4c4f5]">天赋自在</span>
                  <span className="text-[#f5e6a3] ml-2">命理工具箱</span>
                </h1>
                <p className="text-sm text-[#a0a0a0] mt-1 tracking-widest">
                  四柱八字 · 紫微斗数 · 奇门遁甲 · 西方占星
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* 出生信息输入 */}
        <BirthInput onBirthInfoChange={handleBirthInfoChange} />

        {/* 四盘布局 */}
        {birthInfo && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartOrder.map((chartType, index) => renderChart(chartType, index))}
          </div>
        )}

        {/* 说明 */}
        <div className="border-t border-[#3a3530] pt-4 text-center text-sm text-[#a0a0a0]">
          <p>调整出生时辰后，所有盘面联动更新</p>
          <p className="mt-1">
            点击盘面右上角按钮可独立放大/全屏查看
          </p>
        </div>
      </div>

      {/* 页脚 */}
      <footer className="bg-[#2a2624] border-t border-[#3a3530] py-4 mt-8">
        <div className="container mx-auto px-4 text-center text-sm text-[#a0a0a0]">
          <p>
            命理排盘工具 · 使用 lunar-javascript 计算中国传统历法 · 自研天文历表计算西方占星
          </p>
          <p className="mt-1 text-xs text-[#6a6a6a]">
            本工具仅供学术研究与娱乐参考，不构成任何形式的预测或建议
          </p>
        </div>
      </footer>
    </main>
  );
}