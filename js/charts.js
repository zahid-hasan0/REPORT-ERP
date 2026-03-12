// charts.js
let monthlyChart, customerChart, buyerChart, customerMonthlyChart;

export function updateMonthlyChart(bookings) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = new Array(12).fill(0);
    bookings.forEach(b => monthlyData[new Date(b.bookingDate).getMonth()]++);
    const ctx = document.getElementById('monthlyChart');
    if (monthlyChart) monthlyChart.destroy();
    const chartColor = getComputedStyle(document.documentElement).getPropertyValue('--dynamic-chart-primary').trim() || '#2563eb';

    monthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: [
                {
                    label: 'Bookings',
                    data: monthlyData,
                    backgroundColor: chartColor,
                    borderColor: chartColor,
                    borderWidth: 2,
                    borderRadius: 6,
                    order: 2
                },
                {
                    label: 'Monthly Target (150)',
                    data: new Array(12).fill(150),
                    type: 'line',
                    borderColor: '#e11d48', // Crimson/Alert
                    borderWidth: 3,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'end',
                    labels: {
                        boxWidth: 15,
                        font: { size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15,23,42,0.9)',
                    padding: 12,
                    borderRadius: 8
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#000',
                    font: {
                        size: 11,
                        weight: 'bold'
                    },
                    formatter: function (value, ctx) {
                        return ctx.datasetIndex === 0 && value > 0 ? value : '';
                    },
                    offset: 4
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 200,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    title: {
                        display: true,
                        text: 'Number of Bookings',
                        font: { weight: 'bold' }
                    }
                },
                x: {
                    grid: { display: false }
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}



export function updateCustomerChart(bookings) {
    const counts = {};
    bookings.forEach(b => counts[b.customer] = (counts[b.customer] || 0) + 1);
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2);

    const ctx = document.getElementById('customerChart');
    if (customerChart instanceof Chart) {
        customerChart.destroy();
    }

    // Professional ERP color palette
    const colors = [
        '#1900ffff', // Royal Blue
        '#ff0000ff'  // Teal
    ];

    customerChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(c => c[0]),
            datasets: [{
                data: sorted.map(c => c[1]),
                backgroundColor: colors.slice(0, sorted.length),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            layout: {
                padding: {
                    top: 40,
                    bottom: 40,
                    left: 180,
                    right: 180
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    borderRadius: 8,
                    bodyFont: { size: 13, family: "'Inter', sans-serif" },
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} bookings`
                    }
                }
            }
        },
        plugins: [{
            afterDraw: function (chart) {
                const { ctx, chartArea } = chart;
                const meta = chart.getDatasetMeta(0);
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                const labels = [];
                meta.data.forEach((arc, i) => {
                    const angle = (arc.startAngle + arc.endAngle) / 2;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const isRight = cos > 0;

                    const r = arc.outerRadius;
                    const x1 = centerX + cos * r;
                    const y1 = centerY + sin * r;

                    const lineLen = 40 + (Math.abs(sin) * 20);
                    const x2 = centerX + cos * (r + lineLen);
                    const y2 = centerY + sin * (r + lineLen);

                    labels.push({
                        idx: i,
                        x1, y1, x2, y2,
                        isRight,
                        label: sorted[i][0],
                        count: sorted[i][1],
                        yGoal: y2
                    });
                });

                const leftSide = labels.filter(l => !l.isRight).sort((a, b) => a.yGoal - b.yGoal);
                const rightSide = labels.filter(l => l.isRight).sort((a, b) => a.yGoal - b.yGoal);

                const avoidCollision = (side) => {
                    const minGap = 28;
                    for (let i = 1; i < side.length; i++) {
                        if (side[i].yGoal - side[i - 1].yGoal < minGap) {
                            side[i].yGoal = side[i - 1].yGoal + minGap;
                        }
                    }
                    for (let i = side.length - 2; i >= 0; i--) {
                        if (side[i + 1].yGoal - side[i].yGoal < minGap) {
                            side[i].yGoal = side[i + 1].yGoal - minGap;
                        }
                    }
                };

                avoidCollision(leftSide);
                avoidCollision(rightSide);

                [...leftSide, ...rightSide].forEach(l => {
                    const horiz = l.isRight ? 30 : -30;
                    const x3 = l.x2 + horiz;
                    const y3 = l.yGoal;

                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 1.2;
                    ctx.moveTo(l.x1, l.y1);
                    ctx.lineTo(l.x2, y3);
                    ctx.lineTo(x3, y3);
                    ctx.stroke();

                    const textX = x3 + (l.isRight ? 8 : -8);
                    ctx.textAlign = l.isRight ? 'left' : 'right';
                    ctx.textBaseline = 'middle';

                    ctx.fillStyle = '#1e293b';
                    ctx.font = '600 12px "Inter", sans-serif';
                    ctx.fillText(l.label, textX, y3 - 7);

                    ctx.fillStyle = '#64748b';
                    ctx.font = '700 13px "Inter", sans-serif';
                    ctx.fillText(l.count.toString(), textX, y3 + 7);
                    ctx.restore();
                });
            }
        }]
    });
}

export function updateBuyerChart(bookings) {
    const counts = {};

    bookings.forEach(b => {
        counts[b.buyer] = (counts[b.buyer] || 0) + 1;
    });

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    const ctx = document.getElementById('buyerChart');

    if (buyerChart instanceof Chart) {
        buyerChart.destroy();
    }

    const colors = [
        '#0df72cff', '#00f8e3ff', '#d0ff00ff', '#00ff2aff',
        '#1fb1ffd7', '#ff00eaff', '#ff002bff', '#a9ec0dff'
    ];

    buyerChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sorted.map(b => b[0]),
            datasets: [{
                data: sorted.map(b => b[1]),
                backgroundColor: colors.slice(0, sorted.length),
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            layout: {
                padding: {
                    top: 40,
                    bottom: 40,
                    left: 180,    // Increased for very long labels
                    right: 180    // Increased for very long labels
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    borderRadius: 8,
                    bodyFont: { size: 13, family: "'Inter', sans-serif" },
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.parsed} bookings`
                    }
                }
            }
        },
        plugins: [{
            afterDraw: function (chart) {
                const { ctx, chartArea } = chart;
                const meta = chart.getDatasetMeta(0);
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                // Helper to draw clean callouts
                const labels = [];
                meta.data.forEach((arc, i) => {
                    const angle = (arc.startAngle + arc.endAngle) / 2;
                    const cos = Math.cos(angle);
                    const sin = Math.sin(angle);
                    const isRight = cos > 0;

                    const r = arc.outerRadius;
                    const x1 = centerX + cos * r;
                    const y1 = centerY + sin * r;

                    // Dynamic line length based on position
                    const lineLen = 40 + (Math.abs(sin) * 20);
                    const x2 = centerX + cos * (r + lineLen);
                    const y2 = centerY + sin * (r + lineLen);

                    labels.push({
                        idx: i,
                        x1, y1, x2, y2,
                        isRight,
                        label: sorted[i][0],
                        count: sorted[i][1],
                        yGoal: y2
                    });
                });

                // Simple collision avoidance: separate left/right
                const leftSide = labels.filter(l => !l.isRight).sort((a, b) => a.yGoal - b.yGoal);
                const rightSide = labels.filter(l => l.isRight).sort((a, b) => a.yGoal - b.yGoal);

                const avoidCollision = (side) => {
                    const minGap = 28;
                    for (let i = 1; i < side.length; i++) {
                        if (side[i].yGoal - side[i - 1].yGoal < minGap) {
                            side[i].yGoal = side[i - 1].yGoal + minGap;
                        }
                    }
                    // Second pass from bottom to push back up if exceeded area
                    for (let i = side.length - 2; i >= 0; i--) {
                        if (side[i + 1].yGoal - side[i].yGoal < minGap) {
                            side[i].yGoal = side[i + 1].yGoal - minGap;
                        }
                    }
                };

                avoidCollision(leftSide);
                avoidCollision(rightSide);

                [...leftSide, ...rightSide].forEach(l => {
                    const horiz = l.isRight ? 35 : -35;
                    const x3 = l.x2 + horiz;
                    const y3 = l.yGoal;

                    ctx.save();
                    ctx.beginPath();
                    ctx.strokeStyle = '#94a3b8';
                    ctx.lineWidth = 1.2;
                    ctx.moveTo(l.x1, l.y1);
                    ctx.lineTo(l.x2, y3); // Move directly to adjusted Y
                    ctx.lineTo(x3, y3);
                    ctx.stroke();

                    const textX = x3 + (l.isRight ? 8 : -8);
                    ctx.textAlign = l.isRight ? 'left' : 'right';
                    ctx.textBaseline = 'middle';

                    // Title
                    ctx.fillStyle = '#1e293b';
                    ctx.font = '600 12px "Inter", sans-serif';
                    let txt = l.label;
                    ctx.fillText(txt, textX, y3 - 7);

                    // Value
                    ctx.fillStyle = '#64748b';
                    ctx.font = '700 13px "Inter", sans-serif';
                    ctx.fillText(l.count.toString(), textX, y3 + 7);
                    ctx.restore();
                });
            }
        }]
    });
}

export function updateCustomerMonthlyChart(bookings) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const customerCounts = {};
    bookings.forEach(b => {
        customerCounts[b.customer] = (customerCounts[b.customer] || 0) + 1;
    });
    const topCustomers = Object.entries(customerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(c => c[0]);


    const datasets = topCustomers.map((customer, index) => {
        const monthlyData = new Array(12).fill(0);
        bookings.forEach(b => {
            if (b.customer === customer) {
                monthlyData[new Date(b.bookingDate).getMonth()]++;
            }
        });

        const colors = [
            { bg: '#2563eb', border: '#1d4ed8' }, // Blue
            { bg: '#0891b2', border: '#0e7490' }, // Teal
            { bg: '#0ea5e9', border: '#0284c7' }, // Cyan/Sky Blue
            { bg: '#334155', border: '#1e293b' }, // Slate
            { bg: '#d97706', border: '#b45309' }  // Amber
        ];

        return {
            label: customer,
            data: monthlyData,
            backgroundColor: colors[index].bg,
            borderColor: colors[index].border,
            borderWidth: 2,
            borderRadius: 8,
            barPercentage: 0.75,
            categoryPercentage: 0.85
        };
    });

    const ctx = document.getElementById('customerMonthlyChart');
    if (customerMonthlyChart) customerMonthlyChart.destroy();

    customerMonthlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthNames,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    align: 'center',
                    labels: {
                        padding: 12,
                        font: {
                            size: 12,
                            weight: '600',
                            family: "'Segoe UI', Arial, sans-serif"
                        },
                        usePointStyle: true,
                        pointStyle: 'rectRounded',
                        boxWidth: 14,
                        boxHeight: 14,
                        color: '#1e293b'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    padding: 14,
                    borderRadius: 8,
                    titleFont: {
                        size: 14,
                        weight: 'bold'
                    },
                    bodyFont: {
                        size: 13
                    },
                    callbacks: {
                        label: function (context) {
                            return `${context.dataset.label}: ${context.parsed.y} bookings`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#000',
                    font: {
                        size: 11,
                        weight: 'bold',
                        family: "'Segoe UI', Arial, sans-serif"
                    },
                    formatter: function (value) {
                        return value > 0 ? value : '';
                    },
                    offset: 2
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        stepSize: 60,
                        font: {
                            size: 12,
                            family: "'Segoe UI', Arial, sans-serif"
                        },
                        color: '#64748b',
                        padding: 8
                    },
                    border: {
                        display: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 12,
                            family: "'Segoe UI', Arial, sans-serif"
                        },
                        color: '#64748b',
                        padding: 8
                    },
                    border: {
                        display: false
                    }
                }
            },
            layout: {
                padding: {
                    top: 25,
                    right: 15,
                    bottom: 10,
                    left: 10
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}