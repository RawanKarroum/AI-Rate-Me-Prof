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

// Register the necessary components with Chart.js
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

interface DashboardProps {
  analyzedComments: AnalyzedComment[];
}

const Dashboard: React.FC<DashboardProps> = ({ analyzedComments }) => {
  console.log("Dashboard rendered with analyzedComments:", analyzedComments);

  if (!analyzedComments || analyzedComments.length === 0) {
    console.log("No analyzed comments available.");
    return <div>No analyzed comments available.</div>;
  }

  const sentiments = analyzedComments.map((comment) =>
    comment.sentiment === "Positive" ? 1 : comment.sentiment === "Negative" ? -1 : 0
  );
  const dates = analyzedComments.map((comment) => comment.date);

  const chartData = {
    labels: dates,
    datasets: [
      {
        label: "Sentiment Trend",
        data: sentiments,
        borderColor: "rgba(75, 192, 192, 1)",
        fill: false,
      },
    ],
  };

  return (
    <div>
      <Line data={chartData} />
      <ul>
        {analyzedComments.map((commentObj, index) => (
          <li key={index}>
            {commentObj.date}: {commentObj.comment} ({commentObj.sentiment})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Dashboard;
