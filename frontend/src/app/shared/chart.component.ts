import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  viewChild,
} from '@angular/core';
import { Chart, ChartConfiguration, ChartDataset, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);
Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
Chart.defaults.color = '#78716c';

/** Thin wrapper around Chart.js that reacts to input changes. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="relative w-full" [style.height.px]="height()"><canvas #canvas></canvas></div>`,
})
export class ChartComponent implements AfterViewInit, OnDestroy {
  readonly type = input.required<'line' | 'bar' | 'doughnut'>();
  readonly labels = input.required<string[]>();
  readonly datasets = input.required<ChartDataset[]>();
  readonly height = input(260);
  readonly money = input(false);
  readonly horizontal = input(false);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const labels = this.labels();
      const datasets = this.datasets();
      if (!this.chart) return;
      this.chart.data.labels = labels;
      this.chart.data.datasets = datasets;
      this.chart.update();
    });
  }

  ngAfterViewInit() {
    const isDoughnut = this.type() === 'doughnut';
    const formatMoney = (value: number | string) =>
      this.money() ? `$${Number(value).toLocaleString('en-US')}` : value;

    const config: ChartConfiguration = {
      type: this.type() as ChartType,
      data: { labels: this.labels(), datasets: this.datasets() },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: this.horizontal() ? 'y' : 'x',
        plugins: {
          legend: {
            display: isDoughnut || this.datasets().length > 1,
            position: 'bottom',
            labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, padding: 16 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const value = isDoughnut ? ctx.parsed : (this.horizontal() ? ctx.parsed.x : ctx.parsed.y);
                return ` ${ctx.dataset.label ?? ctx.label}: ${formatMoney(value as number)}`;
              },
            },
          },
        },
        ...(isDoughnut
          ? { cutout: '68%' }
          : {
              scales: {
                x: { grid: { display: false }, ticks: this.horizontal() ? { callback: (v) => formatMoney(v) } : {} },
                y: {
                  beginAtZero: true,
                  grid: { color: '#f0eeea' },
                  ticks: this.horizontal() ? {} : { callback: (v) => formatMoney(v), precision: 0 },
                },
              },
            }),
      } as ChartConfiguration['options'],
    };
    this.chart = new Chart(this.canvas().nativeElement, config);
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }
}
