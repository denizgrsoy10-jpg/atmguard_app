import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const atmId = searchParams.get('atmId') || 'ATM001';

    // Mock data - gerçek veritabanından çekilecek
    const mockData = {
      atmId,
      atmName: generateATMName(atmId),
      location: generateLocation(atmId),
      
      // Para Yatırma ve Çekme Arızaları
      depositFailureCount: Math.floor(Math.random() * 20) + 5,
      withdrawalFailureCount: Math.floor(Math.random() * 15) + 3,
      withdrawalNoReplenishCount: Math.floor(Math.random() * 30) + 10,
      
      // Kasa ve Bakiye
      avgCashBalance: Math.floor(Math.random() * 300000) + 150000,
      
      // Arıza ve Müdahale
      faultCount: Math.floor(Math.random() * 10) + 1,
      atmResponseTime: Math.floor(Math.random() * 60) + 30,
      slmResponseTime: Math.floor(Math.random() * 180) + 60,
      
      // Availability
      atmAvailability: Math.random() * 10 + 90,
      locationAvailability: Math.random() * 10 + 88,
      
      // Trend data
      trends: {
        depositFailureTrend: -Math.random() * 20,
        withdrawalFailureTrend: -Math.random() * 15,
        noReplenishTrend: -Math.random() * 25,
        faultTrend: -Math.random() * 20,
      }
    };

    return NextResponse.json({
      success: true,
      data: mockData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ATM Hub API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch ATM hub data',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper functions
function generateATMName(atmId: string): string {
  const branches = [
    'Bakırköy Şube ATM',
    'Kadıköy Şube ATM',
    'Beşiktaş Şube ATM',
    'Üsküdar Şube ATM',
    'Beyoğlu Şube ATM',
    'Şişli Şube ATM',
    'Kartal Şube ATM',
    'Maltepe Şube ATM',
  ];
  const index = parseInt(atmId.replace(/\D/g, '')) % branches.length;
  return branches[index];
}

function generateLocation(atmId: string): string {
  const locations = [
    'İstanbul / Bakırköy',
    'İstanbul / Kadıköy',
    'İstanbul / Beşiktaş',
    'İstanbul / Üsküdar',
    'İstanbul / Beyoğlu',
    'İstanbul / Şişli',
    'İstanbul / Kartal',
    'İstanbul / Maltepe',
  ];
  const index = parseInt(atmId.replace(/\D/g, '')) % locations.length;
  return locations[index];
}
