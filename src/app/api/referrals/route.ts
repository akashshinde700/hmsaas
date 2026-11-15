import { NextRequest } from 'next/server'
import { dbUnscoped } from '@/lib/db'
import { apiJson, invalidateCachePrefix } from '@/lib/cache'
import { getPlatformSession, verifyActiveTenantSession } from '@/lib/auth'

function makeReferralCode(prefix: string, name: string): string {
  const clean = name
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8)
  const rand = Math.floor(10 + Math.random() * 89)
  return `${prefix}-${clean || 'PARTNER'}${rand}`
}

export async function GET(req: NextRequest) {
  const startMs = performance.now()
  const { searchParams } = new URL(req.url)
  const code = (searchParams.get('code') || '').trim().toUpperCase()

  // 1. Public lookup by referral code
  if (code) {
    const partner = await dbUnscoped.affiliatePartner.findUnique({
      where: { referralCode: code },
      include: { leads: { orderBy: { createdAt: 'desc' } } },
    })
    return apiJson({ partner }, { startMs })
  }

  // 2. Platform Admin view: all partners & leads
  const platformAdmin = await getPlatformSession(req)
  if (platformAdmin && searchParams.get('scope') === 'platform') {
    const partners = await dbUnscoped.affiliatePartner.findMany({
      include: { leads: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return apiJson({ partners }, { startMs })
  }

  // 3. Tenant Hospital view: auto-provision or return hospital's referral desk
  const tenant = await verifyActiveTenantSession(req)
  if (tenant) {
    let partner = await dbUnscoped.affiliatePartner.findFirst({
      where: { organizationId: tenant.organizationId },
      include: { leads: { orderBy: { createdAt: 'desc' } } },
    })
    if (!partner) {
      const org = await dbUnscoped.organization.findUnique({
        where: { id: tenant.organizationId },
      })
      const newCode = makeReferralCode('HOSP', org?.name || 'CLINIC')
      partner = await dbUnscoped.affiliatePartner.create({
        data: {
          name: `${org?.name || 'Hospital'} Referral Desk`,
          email: `${tenant.organizationId.slice(0, 8)}-${tenant.email}`,
          companyOrClinic: org?.name || 'Hospital',
          city: org?.city || 'Pune',
          referralCode: newCode,
          commissionPercent: 20,
          organizationId: tenant.organizationId,
        },
        include: { leads: true },
      })
    }
    return apiJson({ partner }, { startMs })
  }

  // 4. Public Program Overview stats
  const totalPartners = await dbUnscoped.affiliatePartner.count()
  return apiJson(
    {
      program: {
        commissionPercent: 20,
        freeMonthBonus: true,
        totalActivePartners: totalPartners,
      },
    },
    { startMs }
  )
}

export async function POST(req: NextRequest) {
  const startMs = performance.now()
  const body = await req.json()
  const action = String(body.action || 'registerPartner')

  if (action === 'trackClick') {
    const code = String(body.referralCode || '').trim().toUpperCase()
    if (code) {
      await dbUnscoped.affiliatePartner.updateMany({
        where: { referralCode: code },
        data: { clicksCount: { increment: 1 } },
      })
    }
    return apiJson({ ok: true }, { startMs })
  }

  if (action === 'registerPartner') {
    const name = String(body.name || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    if (!name || !email) {
      return apiJson({ error: 'Partner name and email are required.' }, { status: 400, startMs })
    }

    const existing = await dbUnscoped.affiliatePartner.findUnique({
      where: { email },
      include: { leads: { orderBy: { createdAt: 'desc' } } },
    })
    if (existing) {
      return apiJson({ partner: existing, alreadyRegistered: true }, { startMs })
    }

    const referralCode = makeReferralCode('AFF', body.companyOrClinic || name)
    const partner = await dbUnscoped.affiliatePartner.create({
      data: {
        name,
        email,
        phone: body.phone ? String(body.phone) : null,
        companyOrClinic: body.companyOrClinic ? String(body.companyOrClinic) : null,
        city: body.city ? String(body.city) : 'Pune',
        upiOrBankDetails: body.upiOrBankDetails ? String(body.upiOrBankDetails) : null,
        referralCode,
        commissionPercent: 20,
      },
      include: { leads: true },
    })

    return apiJson({ partner }, { status: 201, startMs })
  }

  if (action === 'submitLead') {
    const referralCode = String(body.referralCode || '').trim().toUpperCase()
    const referredClinicName = String(body.referredClinicName || '').trim()
    const contactName = String(body.contactName || '').trim()
    const contactPhone = String(body.contactPhone || '').trim()

    if (!referralCode || !referredClinicName || !contactName || !contactPhone) {
      return apiJson(
        { error: 'Referral code, clinic name, doctor/admin name, and phone are required.' },
        { status: 400, startMs }
      )
    }

    const partner = await dbUnscoped.affiliatePartner.findUnique({
      where: { referralCode },
    })
    if (!partner) {
      return apiJson({ error: 'Invalid referral code.' }, { status: 404, startMs })
    }

    const planInterested = String(body.planInterested || 'Advance Hospital')
    const estReward = planInterested.toLowerCase().includes('enterprise')
      ? 1999
      : planInterested.toLowerCase().includes('advance')
      ? 999
      : 499

    const [lead] = await dbUnscoped.$transaction([
      dbUnscoped.referralLead.create({
        data: {
          partnerId: partner.id,
          referredClinicName,
          contactName,
          contactPhone,
          contactEmail: body.contactEmail ? String(body.contactEmail) : null,
          city: body.city ? String(body.city) : 'Pune',
          planInterested,
          rewardAmountINR: estReward,
        },
      }),
      dbUnscoped.affiliatePartner.update({
        where: { id: partner.id },
        data: {
          totalReferrals: { increment: 1 },
          pendingPayoutINR: { increment: estReward },
        },
      }),
      dbUnscoped.platformInquiry.create({
        data: {
          clinicName: referredClinicName,
          contactName,
          email: body.contactEmail ? String(body.contactEmail) : `ref-${Date.now()}@referral.aethermed.in`,
          phone: contactPhone,
          city: body.city ? String(body.city) : 'Pune',
          facilityType: 'Hospital (Referred)',
          selectedPlan: planInterested,
          message: `Referred via Partner Code ${referralCode} (${partner.name})`,
          status: 'new',
        },
      }),
    ])

    invalidateCachePrefix('public:')
    return apiJson({ lead }, { status: 201, startMs })
  }

  // Platform Admin actions: convert referral / mark payout
  const platformAdmin = await getPlatformSession(req)
  if (!platformAdmin) {
    return apiJson({ error: 'Unauthorized' }, { status: 401, startMs })
  }

  if (action === 'approveLead') {
    const leadId = String(body.leadId || '')
    const lead = await dbUnscoped.referralLead.findUnique({ where: { id: leadId } })
    if (!lead) return apiJson({ error: 'Lead not found' }, { status: 404, startMs })

    await dbUnscoped.$transaction([
      dbUnscoped.referralLead.update({
        where: { id: lead.id },
        data: { status: 'converted' },
      }),
      dbUnscoped.affiliatePartner.update({
        where: { id: lead.partnerId },
        data: {
          convertedCount: { increment: 1 },
          totalEarnedINR: { increment: lead.rewardAmountINR },
        },
      }),
    ])
    return apiJson({ ok: true }, { startMs })
  }

  return apiJson({ error: 'Unknown referral action' }, { status: 400, startMs })
}
