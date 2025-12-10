import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 기존 테스트 데이터 정리
  console.log('🧹 Cleaning up old test data...')

  // 기존 계약서 삭제
  await prisma.contract.deleteMany({})
  console.log('  - Deleted all contracts')

  // 기존 패키지 삭제
  await prisma.package.deleteMany({})
  console.log('  - Deleted all packages')

  // 패키지 데이터 생성 - 단일 패키지 (온라인 영업 올인원 패키지)
  const packages = [
    {
      name: 'MARKETING',
      displayName: '온라인 영업 올인원 패키지',
      price: 3300000,
      description: '홈페이지 제작 + Meta 광고 자동화 + 인쇄물 (VAT 포함)',
      features: [
        // 인쇄물
        '명함 200매',
        '대봉투 500매',
        '계약서 500매',
        '명찰',
        // 홈페이지
        '홈페이지 10페이지 이내',
        '반응형 디자인',
        '도메인 1년 무료',
        '호스팅 1년 무료',
        // 광고지원
        'Meta 광고 연동',
        '자동화 설정',
        '실시간 알림',
        '리포팅 대시보드',
      ],
      sortOrder: 1,
    },
  ]

  for (const pkg of packages) {
    await prisma.package.upsert({
      where: { name: pkg.name },
      update: pkg,
      create: pkg,
    })
  }
  console.log(`✅ Created ${packages.length} packages`)

  // 테스트 사용자 생성 (옵션)
  const hashedPassword = await bcrypt.hash('1234', 10)

  const testUser = await prisma.user.upsert({
    where: { email: 'test@polarad.co.kr' },
    update: {},
    create: {
      clientName: '테스트업체',
      name: '홍길동',
      email: 'test@polarad.co.kr',
      phone: '01012345678',
      password: hashedPassword,
      smsConsent: true,
      emailConsent: true,
    },
  })

  console.log(`✅ Created test user: ${testUser.clientName} (${testUser.email})`)
  console.log(`   Login: 클라이언트명: 테스트업체, 연락처: 01012345678, PIN: 1234`)

  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

// 추가: 관리자 계정 생성을 위한 별도 함수
async function createAdmin() {
  const adminPassword = await bcrypt.hash('Qnwkchqnwk2@', 12)
  
  const admin = await prisma.admin.upsert({
    where: { email: 'pola@polarad.co.kr' },
    update: { password: adminPassword },
    create: {
      email: 'pola@polarad.co.kr',
      name: 'Polarad Admin',
      password: adminPassword,
      role: 'SUPER',
      isActive: true,
    },
  })
  
  console.log('Admin created:', admin.email)
}
