
const API_URL = 'http://localhost:3001/api';

async function testEndpoints() {
    try {
        console.log("Testing /api/health...");
        const healthRes = await fetch(`${API_URL}/health`);
        const healthData = await healthRes.json();
        console.log("Health:", healthData);

        console.log("\nTesting /api/sales (Pagination)...");
        const salesRes = await fetch(`${API_URL}/sales?page=1&limit=5`);
        const salesData = await salesRes.json();

        console.log("Sales Pagination Info:", salesData.pagination);
        console.log(`Received ${salesData.data.length} rows.`);
        console.log("Sample Row:", salesData.data[0]);

    } catch (e) {
        console.error("Test Failed:", e.message);
    }
}

testEndpoints();
