import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const email = 'test@example.com'
    const password = '123456'
    const username = 'testuser'

    const hashedPassword = await bcrypt.hash(password, 10)

    // Upsert the user
    await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
        },
        create: {
            username,
            email,
            password: hashedPassword,
            Portfolio: {
                create: {
                    isPublic: true
                }
            }
        }
    })

    console.log('Created test user:')
    console.log('Email:', email)
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
