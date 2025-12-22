// components/charts/EarningsChart.tsx
import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface EarningsChartProps {
  monthlyEarnings: Array<{month: string, earnings: number}>;
}

const EarningsChart: React.FC<EarningsChartProps> = ({ monthlyEarnings }) => {
  const data = {
    labels: monthlyEarnings.map(item => item.month),
    datasets: [
      {
        label: 'Monthly Earnings (ShamCoins)',
        data: monthlyEarnings.map(item => item.earnings),
        borderColor: 'rgb(72, 187, 120)',
        backgroundColor: 'rgba(72, 187, 120, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(72, 187, 120)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 6
      }
    ]
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            size: 14
          }
        }
      },
      title: {
        display: true,
        text: 'Earnings Trend',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed.y;
            return value !== null && value !== undefined ? `£${value.toFixed(2)}` : '£0.00';
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          callback: (value) => {
            if (typeof value === 'number') {
              return `£${value}`;
            }
            return value;
          }
        }
      },
      x: {
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div style={{ height: '400px', margin: '20px 0' }}>
      <Line data={data} options={options} />
    </div>
  );
};

export default EarningsChart;