'use client';

import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface AnalyzedComment {
    comment: string;
    sentiment: string;
    date: string;
}

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        borderColor: string;
        fill: boolean;
    }[];
}

const Dashboard: React.FC<{ analyzedComments: AnalyzedComment[] }> = ({ analyzedComments = [] }) => {
    const [chartData, setChartData] = useState<ChartData | null>(null);

    console.log("Dashboard rendered with analyzedComments:", analyzedComments);

    useEffect(() => {
        if (analyzedComments && analyzedComments.length > 0) {
            console.log("Analyzed comments available:", analyzedComments);

            const sentiments = analyzedComments.map(comment => {
                if (comment.sentiment.includes('Positive')) return 1;
                if (comment.sentiment.includes('Negative')) return -1;
                return 0; // Neutral
            });

            console.log("Mapped sentiments:", sentiments);

            const dates = analyzedComments.map(comment => {
                const date = new Date(comment.date);
                return `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
            });

            console.log("Mapped dates:", dates);

            const data: ChartData = {
                labels: dates,
                datasets: [{
                    label: 'Sentiment Trend',
                    data: sentiments,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    fill: false,
                }],
            };

            console.log("Final chart data:", data);

            setChartData(data);
        } else {
            console.log("No analyzed comments available.");
        }
    }, [analyzedComments]);

    return (
        <div>
            {chartData ? (
                <>
                    <Line data={chartData} />
                    <ul>
                        {analyzedComments.map((commentObj, index) => (
                            <li key={index}>
                                {commentObj.date}: {commentObj.comment} ({commentObj.sentiment})
                            </li>
                        ))}
                    </ul>
                </>
            ) : (
                <p>No comments available</p>
            )}
        </div>
    );
};

export default Dashboard;
