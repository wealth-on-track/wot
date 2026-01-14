
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get the email to keep from command line arguments
    const keepEmail = process.argv[2];

    if (!keepEmail) {
        console.error('Please provide the email address to KEEP as an argument.');
        process.exit(1);
    }

    console.log(`Starting cleanup... Protecting user: ${keepEmail}`);

    try {
        // Check who will be deleted (optional but good for log)
        const usersToDelete = await prisma.user.findMany({
            where: {
                email: {
                    not: keepEmail
                }
            },
            select: {
                id: true,
                email: true,
                username: true
            }
        });

        if (usersToDelete.length === 0) {
            console.log('No users found to delete.');
            return;
        }

        console.log(`Found ${usersToDelete.length} users to delete:`);
        usersToDelete.forEach(u => console.log(`- ${u.username} (${u.email})`));

        // Get user IDs to delete
        const userIdsToDelete = usersToDelete.map(u => u.id);

        // 1. Delete Assets linked to these users' portfolios
        // Find portfolios first to be safe, or use nested query
        console.log('Deleting dependent Assets...');
        const resultAssets = await prisma.asset.deleteMany({
            where: {
                portfolio: {
                    userId: {
                        in: userIdsToDelete
                    }
                }
            }
        });
        console.log(`Deleted ${resultAssets.count} Assets.`);

        // 2. Delete Portfolios (this should cascade Goals and Snapshots if configured, 
        // but Assets were not cascaded in schema)
        console.log('Deleting dependent Portfolios...');
        const resultPortfolios = await prisma.portfolio.deleteMany({
            where: {
                userId: {
                    in: userIdsToDelete
                }
            }
        });
        console.log(`Deleted ${resultPortfolios.count} Portfolios.`);

        // 3. Finally delete Users
        console.log('Deleting Users...');
        const result = await prisma.user.deleteMany({
            where: {
                // Double check we are using the filtered list's IDs or the email condition
                id: {
                    in: userIdsToDelete
                }
            }
        });

        console.log(`Successfully deleted ${result.count} users.`);
        console.log(`Remaining user(s):`);

        const remainingUsers = await prisma.user.findMany({
            select: { username: true, email: true }
        });
        remainingUsers.forEach(u => console.log(`+ ${u.username} (${u.email})`));

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
