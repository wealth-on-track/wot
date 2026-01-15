import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load production environment
dotenv.config({ path: join(__dirname, '.env.production') });

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

async function checkProductionData() {
    try {
        console.log('🔍 Checking PRODUCTION database...\n');

        // Get all users
        const users = await prisma.user.findMany({
            select: {
                username: true,
                email: true,
                createdAt: true,
                portfolio: {
                    select: {
                        id: true,
                        _count: {
                            select: {
                                assets: true,
                                snapshots: true
                            }
                        }
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        console.log('=== ALL USERS IN PRODUCTION ===');
        users.forEach(user => {
            console.log(`\n👤 Username: ${user.username}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Created: ${user.createdAt.toISOString().split('T')[0]}`);
            console.log(`   Portfolio ID: ${user.portfolio?.id || 'N/A'}`);
            console.log(`   📊 Assets: ${user.portfolio?._count.assets || 0}`);
            console.log(`   📸 Snapshots: ${user.portfolio?._count.snapshots || 0}`);
        });

        console.log(`\n📈 Total Users: ${users.length}`);

        // Check if demo user exists
        const demoUser = users.find(u => u.username === 'demo');
        if (demoUser) {
            console.log('\n✅ Demo user found!');

            // Get recent snapshots for demo user
            if (demoUser.portfolio) {
                const snapshots = await prisma.portfolioSnapshot.findMany({
                    where: {
                        portfolioId: demoUser.portfolio.id
                    },
                    orderBy: {
                        date: 'desc'
                    },
                    take: 10
                });

                console.log('\n📸 Recent Demo Snapshots:');
                if (snapshots.length > 0) {
                    snapshots.forEach(s => {
                        console.log(`   ${s.date.toISOString().split('T')[0]}: €${s.totalValue.toFixed(2)}`);
                    });
                } else {
                    console.log('   ⚠️  NO SNAPSHOTS FOUND!');
                }
            }
        } else {
            console.log('\n❌ Demo user NOT found in production!');
        }

        // Check benchmark prices
        const benchmarkCount = await prisma.benchmarkPrice.count();
        console.log(`\n📊 Benchmark Prices in DB: ${benchmarkCount}`);

        if (benchmarkCount > 0) {
            const recentBenchmarks = await prisma.benchmarkPrice.findMany({
                orderBy: {
                    date: 'desc'
                },
                take: 5
            });
            console.log('\n📈 Recent Benchmark Prices:');
            recentBenchmarks.forEach(b => {
                console.log(`   ${b.symbol} - ${b.date.toISOString().split('T')[0]}: $${b.price.toFixed(2)}`);
            });
        } else {
            console.log('   ⚠️  NO BENCHMARK PRICES FOUND!');
        }

        // Check cron secret
        console.log('\n🔐 Environment Check:');
        console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ SET' : '❌ NOT SET'}`);
        console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET'}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkProductionData();
