// The page you were given (EN): Alder County — Housing Stability Grant, online application.
//
// Everything here is portal content, written to read like a real county site (§9: ugly through
// realism, never parody). Plain versions keep every fact and every digit sequence (I3), use
// shorter sentences and common words, speak to "you", and add no claims. `legal` blocks get a
// summary that the UI shows BESIDE the original, never instead of it (§11). Terms appear
// verbatim in both the original and the plain version so they can be underlined in either.
//
// Block order is the portal's DOM order. The deadline is the fourth paragraph of the body.
import type { PageContent } from '../engine/schema.ts';

export const contentEn: PageContent = {
  meta: {
    title: 'Housing Stability Grant — online application',
    lang: 'en',
    stepOrder: [
      { id: 'start', title: 'Before you start' },
      { id: 'you', title: 'About you' },
      { id: 'home', title: 'Your home' },
      { id: 'income', title: 'Your income' },
      { id: 'review', title: 'Review and submit' },
    ],
  },
  blocks: [
    // ----------------------------------------------------------------- header
    {
      id: 'nav-main',
      kind: 'nav',
      importance: 'primary',
      region: 'header',
      items: [
        'Home',
        'Benefits',
        'Housing',
        'Apply',
        'Check status',
        'Documents',
        'Forms',
        'FAQ',
        'Contact',
        'Accessibility',
        'Language',
        'Sign in',
      ],
    },
    {
      id: 'nav-utility',
      kind: 'nav',
      importance: 'secondary',
      region: 'utility',
      items: ['Text size', 'Print', 'Share', 'Translate', 'Help'],
    },
    {
      id: 'promo-app',
      kind: 'promo',
      importance: 'decorative',
      region: 'header',
      complexity: 'simple',
      text: 'Get the Alder County Benefits app. Check your application status, upload documents and get reminders on your phone. Free on the App Store and Google Play.',
    },
    {
      id: 'notice-maintenance',
      kind: 'notice',
      importance: 'secondary',
      complexity: 'simple',
      text: 'Scheduled maintenance: this portal will be unavailable on Sunday, September 20, 2026, from 2:00 to 4:00 a.m. Drafts saved before the outage will not be affected. We apologize for any inconvenience.',
    },

    // ------------------------------------------------------------------- body
    {
      id: 'heading-title',
      kind: 'heading',
      level: 1,
      importance: 'primary',
      complexity: 'simple',
      text: 'Housing Stability Grant — online application',
    },
    {
      id: 'image-hero',
      kind: 'image',
      importance: 'decorative',
      src: '/img/hero-rowhouses.svg',
      alt: 'Illustration of a row of houses on a tree-lined residential street',
      decorative: true,
    },
    {
      id: 'intro',
      kind: 'text',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: 'The Housing Stability Grant (HSG) is a means-tested, one-time assistance program administered by the Alder County Department of Community Services on behalf of the Board of Supervisors. The program provides remittance of rental arrears and associated utility arrears directly to the landlord or utility provider of an eligible household in order to prevent an imminent loss of tenancy. Awards are subject to the availability of appropriated funds and are issued in the order in which complete applications are adjudicated. Disbursement is contingent upon the execution of a landlord participation agreement and verification of the arrearage amount. Grant funds are not paid to applicants, do not constitute a recurring subsidy, and do not constitute a determination of eligibility for any other county, state or federal program.',
      plainText:
        'The Housing Stability Grant is a one-time payment for households about to lose their home because of unpaid rent. It is means-tested: your income must be below a set limit. The county pays your rent arrears, and in some cases your utility arrears, by remittance straight to your landlord or utility company. The money never goes to you. Funding is limited, and complete applications are handled in the order they are checked. Disbursement happens only after your landlord signs a participation agreement and the county confirms how much you owe. This grant is paid once. It is not a monthly payment, and getting it does not mean you qualify for any other program.',
      terms: [
        { term: 'means-tested', plain: 'Whether you qualify depends on your income being below a set limit.' },
        { term: 'arrears', plain: 'Money you owe because a payment was missed or is late.' },
        {
          term: 'remittance',
          plain: 'Sending a payment. Here, the county paying your landlord or utility company directly.',
        },
        { term: 'disbursement', plain: 'Paying out the grant money.' },
      ],
    },
    {
      id: 'eligibility',
      kind: 'legal',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: 'Eligibility. An applicant shall be eligible for assistance under this program only where each of the following conditions is satisfied: (a) the applicant is a party to a written or oral tenancy agreement for a dwelling unit located within Alder County and has occupied the unit as their principal residence for not less than 90 days; (b) gross household income for the 30 days preceding the date of application does not exceed 80% of the area median income for Alder County, as published by the U.S. Department of Housing and Urban Development and adjusted for household size; (c) the household is in arrears of rent for a period of not less than 30 days, or has received a written notice to pay or quit; (d) the total amount requested does not exceed $2,500 per household in any 12-month period; and (e) no member of the household has received assistance under this program within the preceding 12 months. Households in receipt of a tenant-based housing subsidy are eligible only in respect of the tenant portion of the rent.',
      plainText:
        "You can apply only if all of these are true: you rent a home in Alder County and have lived there for at least 90 days; your household's income in the last 30 days was no more than 80% of the area median income for the county, adjusted for how many people live with you; you are at least 30 days behind on rent, or you have received a written notice to pay or quit; you are asking for no more than $2,500 for your household in a 12-month period; and nobody in your household has received this grant in the last 12 months. If you have a tenant-based housing subsidy, such as a voucher, the grant can cover only your share of the rent.",
      terms: [
        {
          term: 'area median income',
          plain:
            'The middle household income for the county: half of households earn more, half earn less. The income limit is a share of it.',
        },
        {
          term: 'notice to pay or quit',
          plain: 'A written warning from a landlord: pay the rent you owe by a set date or move out.',
        },
        {
          term: 'tenant-based housing subsidy',
          plain: 'Rent help that follows you, such as a housing voucher, so you pay only part of the rent yourself.',
        },
      ],
    },
    {
      id: 'adjudication',
      kind: 'text',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: 'Applications are adjudicated by the Housing Services Division in the order in which they are deemed complete. An application is deemed complete only when every required field has been answered, every required document has been uploaded in an accepted format, and the landlord has returned the participation agreement. Applicants may be contacted by telephone or by secure message for clarification; a request for clarification that remains unanswered for 10 business days will result in the application being closed without prejudice. Determinations are issued in writing to the address of record. An applicant aggrieved by a determination may request reconsideration within 15 business days of the date of the determination letter by submitting Form HSG-7. Reconsideration is limited to the record as submitted; new documentation will not be accepted at that stage.',
      plainText:
        'The Housing Services Division checks applications in the order they become complete. Your application is complete when you have answered every required question, uploaded every required document in an accepted file type, and your landlord has sent back the participation agreement. Staff may phone you or send you a secure message if something is unclear. If you do not reply within 10 business days, your application is closed without prejudice, which means the closure does not count against you. The decision is sent to you in writing at the address you gave. If you disagree with it, you have 15 business days from the date on the letter to ask for a review, using Form HSG-7. The review looks only at what you already sent. You cannot add new documents at that point.',
      terms: [
        {
          term: 'without prejudice',
          plain: 'Closing the application this way does not count against you; you can apply again.',
        },
      ],
    },
    {
      id: 'deadline',
      kind: 'deadline',
      importance: 'critical',
      group: 'start',
      date: '2026-10-23',
      text: 'Complete applications are reviewed in the order received, and the Division may close the application period early if the appropriated funds are exhausted. Applications must be received by 11:59 p.m. on Friday, October 23, 2026. Late or incomplete submissions will not be considered for this funding cycle; applicants may reapply in a subsequent cycle if one is announced.',
      plainText:
        'Your application must reach the county by 11:59 p.m. on Friday, October 23, 2026. Complete applications are looked at in the order they arrive, and the county may stop taking applications early if the money runs out. Late or incomplete applications will not be considered this round. If another round is announced, you can apply again.',
    },
    {
      id: 'what-you-need',
      kind: 'instruction',
      importance: 'primary',
      group: 'start',
      complexity: 'complex',
      text: 'Before you begin, assemble the following documentation. Each file must be in PDF, JPG or PNG format and no larger than 10 MB. (1) Government-issued photo identification for the applicant. (2) Proof of tenancy: a current lease or, where no written lease exists, a notarized landlord affidavit (Form HSG-3). (3) Proof of income for every adult household member for the 30 days preceding the application: pay stubs, a benefits award letter, or a self-attestation of zero income. (4) A current rent ledger or a written statement from the landlord showing the arrearage amount and the period to which it relates. (5) Any notice to pay or quit, notice of termination or court filing received in connection with the tenancy. Incomplete submissions cannot be processed and will be returned to the applicant.',
      plainText:
        'Get these documents ready before you start. Each file must be a PDF, JPG or PNG, and no bigger than 10 MB. (1) A photo ID issued by the government. (2) Proof of tenancy, which shows you rent the home: your current lease or, if you have no written lease, a notarized statement from your landlord (Form HSG-3). (3) Proof of income for every adult in your home for the last 30 days: pay stubs, a benefits award letter, or a self-attestation that you had no income. (4) A rent ledger or a letter from your landlord showing how much you owe and for which period. (5) Any notice to pay or quit, notice ending your tenancy, or court papers about your home. The county cannot process an incomplete application and will send it back to you.',
      terms: [
        { term: 'proof of tenancy', plain: 'A document that shows you rent the home, such as a lease.' },
        {
          term: 'self-attestation',
          plain: 'A statement you sign yourself to say something is true, with no other proof attached.',
        },
      ],
    },
    {
      id: 'image-documents',
      kind: 'image',
      importance: 'primary',
      group: 'start',
      src: '/img/documents-checklist.svg',
      alt: 'The five documents you will need, in order: photo ID, lease, proof of income, rent ledger, and any notice from your landlord',
      decorative: false,
    },

    // ---------------------------------------------------------------- sidebar
    {
      id: 'nav-related',
      kind: 'nav',
      importance: 'secondary',
      region: 'sidebar',
      items: [
        'Emergency Rental Assistance (closed)',
        'Utility Assistance Program',
        'Tenant Rights and Mediation Program',
        'Homelessness prevention hotline',
        'Find a community partner',
        'Landlord participation agreement',
        'Income limits 2026 (PDF)',
        'Program guidelines (PDF)',
      ],
    },
    {
      id: 'announcement-hours',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'simple',
      text: 'Walk-in help: the Housing Services counter at 240 Main Street is open Monday to Friday, 8:30 a.m. to 4:30 p.m. No appointment is needed.',
    },
    {
      id: 'announcement-access',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'simple',
      text: 'Language help: free interpretation is available by phone in Spanish, Vietnamese, Mandarin and Somali. Ask for an interpreter when you call.',
    },
    {
      id: 'announcement-scams',
      kind: 'text',
      importance: 'secondary',
      region: 'sidebar',
      complexity: 'medium',
      text: 'Beware of scams. Alder County never charges a fee to apply and never asks for payment by gift card or wire transfer. Report suspicious calls or messages to the County Fraud Line.',
      plainText:
        'Beware of scams. Alder County never charges a fee to apply, and never asks you to pay by gift card or wire transfer. If you get a suspicious call or message, report it to the County Fraud Line.',
    },
    {
      id: 'promo-rate',
      kind: 'promo',
      importance: 'decorative',
      region: 'sidebar',
      complexity: 'simple',
      text: 'Was this page helpful? Rate your experience and help us improve Alder County online services. It takes less than a minute.',
    },

    // ------------------------------------------------------------------- form
    {
      id: 'heading-form',
      kind: 'heading',
      level: 2,
      importance: 'primary',
      complexity: 'simple',
      text: 'Application form',
    },
    {
      id: 'form-instruction',
      kind: 'instruction',
      importance: 'primary',
      group: 'you',
      complexity: 'medium',
      text: 'Fields marked * are required. Fields marked (required) must also be completed. Your session will time out after 20 minutes of inactivity; use Save draft to keep your progress. Do not use the browser Back button while completing the form.',
      plainText:
        'You must fill in every field marked * or (required). If you do nothing for 20 minutes, the page will log you out, so use Save draft to keep what you have entered. Do not use the Back button in your browser while you fill in the form.',
    },

    // about you
    {
      id: 'field-full-name',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: 'Full legal name',
      input: 'text',
      required: true,
      help: 'Enter your name as it appears on your government-issued photo identification, including any middle name or suffix.',
      plainHelp:
        'Type your name the way it is written on your photo ID, including any middle name or ending such as Jr.',
    },
    {
      id: 'field-date-of-birth',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: 'Date of birth',
      input: 'date',
      required: true,
      help: 'Format MM/DD/YYYY. Applicants must be 18 years of age or older, or an emancipated minor with supporting documentation.',
      plainHelp:
        'Use the format month/day/year. You must be 18 or older to apply. If you are younger and legally independent from your parents (an emancipated minor), you will need papers that show it.',
    },
    {
      id: 'field-phone',
      kind: 'field',
      importance: 'critical',
      group: 'you',
      label: 'Telephone number',
      input: 'tel',
      required: true,
      help: 'Include the area code. This number may be used for verification calls during business hours (8:00 a.m. to 5:00 p.m.).',
      plainHelp:
        'Include your area code. County staff may call this number to check details, between 8:00 a.m. and 5:00 p.m.',
    },
    {
      id: 'field-email',
      kind: 'field',
      importance: 'primary',
      group: 'you',
      label: 'Email address',
      input: 'email',
      required: false,
      help: 'If provided, determinations and requests for clarification will be sent to this address in lieu of postal mail.',
      plainHelp:
        'If you give an email address, decisions and questions about your application will be sent there instead of by post.',
    },

    // your home
    {
      id: 'field-street-address',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: 'Street address of the rental unit',
      input: 'text',
      required: true,
      help: 'The address of the unit for which assistance is requested, including the apartment or unit number.',
      plainHelp: 'The address of the home you rent and need help with, including the apartment or unit number.',
    },
    {
      id: 'field-city-postcode',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: 'City and ZIP code',
      input: 'text',
      required: true,
      help: 'The unit must be located within the unincorporated area of Alder County or in one of its participating municipalities.',
      plainHelp:
        "The home must be in Alder County: either in the county's own area or in one of the towns and cities that take part in the program.",
    },
    {
      id: 'field-household-size',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: 'Household size',
      input: 'number',
      required: true,
      help: 'Count every person who resides in the unit, including children and non-relatives. Do not count individuals who have been temporarily absent for more than 60 consecutive days.',
      plainHelp:
        'Count everyone who lives in the home, including children and people who are not family. Do not count anyone who has been away for more than 60 days in a row.',
    },
    {
      id: 'field-residence-type',
      kind: 'field',
      importance: 'critical',
      group: 'home',
      label: 'Tenancy type',
      input: 'select',
      required: true,
      options: [
        'Written lease',
        'Month-to-month agreement',
        'Oral agreement',
        'Subsidized tenancy (voucher or project-based)',
        'Other',
      ],
      help: 'Select the arrangement under which you occupy the unit. Subsidized tenancies are eligible for the tenant portion of the rent only.',
      plainHelp:
        'Choose the kind of rental agreement you have. If part of your rent is paid by a voucher or similar help, the grant can cover only the part you pay yourself.',
    },

    // your income
    {
      id: 'field-monthly-income',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: 'Gross monthly household income',
      input: 'number',
      required: true,
      help: 'Enter the combined gross income of all adult household members for the 30 days preceding the date of application, before taxes and deductions. Round to the nearest dollar.',
      plainHelp:
        'Add up what every adult in your home received in the last 30 days, before tax and other deductions. Round to the nearest dollar.',
    },
    {
      id: 'field-income-source',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: 'Primary source of household income',
      input: 'select',
      required: true,
      options: [
        'Wages or salary',
        'Self-employment',
        'Unemployment insurance',
        'Social Security or SSI',
        'Public assistance (TANF or General Assistance)',
        'Child support or alimony',
        'No income',
        'Other',
      ],
      help: 'Select the source that accounts for the largest share of household income.',
      plainHelp: "Choose where most of your household's money comes from.",
    },
    {
      id: 'field-proof-of-income',
      kind: 'field',
      importance: 'critical',
      group: 'income',
      label: 'Proof of income',
      input: 'file',
      required: true,
      help: 'Upload pay stubs, an award letter or a completed zero-income self-attestation (Form HSG-5) for each adult household member. Accepted formats: PDF, JPG, PNG; maximum 10 MB per file.',
      plainHelp:
        'Upload pay stubs, a benefits letter, or a signed statement that you had no income (Form HSG-5), for each adult in your home. Files must be PDF, JPG or PNG and no bigger than 10 MB each.',
    },
    {
      id: 'field-hardship-statement',
      kind: 'field',
      importance: 'primary',
      group: 'income',
      label: 'Hardship statement',
      input: 'text',
      required: false,
      help: 'Optional. Briefly describe the circumstances that led to the arrearage (for example, loss of employment, medical expenses, or a reduction in hours). Maximum 1,000 characters.',
      plainHelp:
        'You do not have to fill this in. If you want, explain in a few sentences why you fell behind on rent, for example losing a job, medical bills, or fewer working hours. Up to 1,000 characters.',
    },

    // review and submit
    {
      id: 'decision-share-data',
      kind: 'decision',
      importance: 'primary',
      group: 'review',
      label:
        'I agree that Alder County may share my application information with partner organizations so that they can contact me about related services for which I may be eligible.',
      plainLabel:
        'You are letting Alder County pass your application details to other organizations, so they can contact you about other services. This is optional.',
      optional: true,
      preChecked: true,
      consequence:
        'Checking this lets the county give your name, contact details and the information in this application to nonprofit and community organizations it works with. They may contact you about their services. It is optional, and your choice does not affect the grant decision.',
    },
    {
      id: 'decision-attest',
      kind: 'decision',
      importance: 'critical',
      group: 'review',
      label:
        'I certify under penalty of perjury that the information provided in this application and in any attached documentation is true, correct and complete to the best of my knowledge, and I understand that any misrepresentation may result in denial of assistance, recovery of funds disbursed, and referral for prosecution.',
      plainLabel:
        'You are promising that everything in this application and its documents is true and complete, as far as you know. If something is false, the county can refuse the grant, take back money it has paid, and report you for prosecution. You must check this box to submit.',
      optional: false,
      preChecked: false,
    },
    {
      id: 'privacy-notice',
      kind: 'legal',
      importance: 'critical',
      region: 'footer',
      group: 'review',
      complexity: 'complex',
      text: 'Privacy notice. The information collected on this form is requested under the authority of Alder County Code Chapter 8.24 and is used to determine eligibility for the Housing Stability Grant, to administer payments, and to compile program statistics. Provision of the requested information is voluntary; however, failure to provide it may result in the denial of assistance. Application records, including supporting documentation, are retained for 7 years from the date of final determination in accordance with the County Records Retention Schedule, after which they are destroyed. Information may be disclosed to the landlord or utility provider named in the application for the purpose of payment, to auditors, and as otherwise required by law. You may request access to, or correction of, your records by contacting the Records Custodian of the Department of Community Services.',
      plainText:
        'The county collects this information under Alder County Code Chapter 8.24. It uses it to decide whether you get the grant, to make the payment, and to keep program statistics. You do not have to give this information, but the county may refuse the grant if you do not. Your application and documents are kept for 7 years after the final decision, then destroyed. The county may share your information with the landlord or utility company named in your application in order to pay them, with auditors, and when the law requires it. You can ask to see or correct your records by contacting the Records Custodian of the Department of Community Services.',
      terms: [
        {
          term: 'Records Custodian',
          plain: 'The county official responsible for keeping records and handling requests to see or correct them.',
        },
      ],
    },
    {
      id: 'action-save-draft',
      kind: 'action',
      importance: 'primary',
      group: 'review',
      label: 'Save draft',
      primary: false,
    },
    {
      id: 'action-submit',
      kind: 'action',
      importance: 'critical',
      group: 'review',
      label: 'Submit application',
      primary: true,
    },
    {
      id: 'action-download-pdf',
      kind: 'action',
      importance: 'secondary',
      group: 'review',
      label: 'Download PDF',
      primary: false,
    },
    {
      id: 'action-chat',
      kind: 'action',
      importance: 'decorative',
      label: 'Chat with an agent',
      primary: false,
    },

    // -------------------------------------------------------------------- faq
    {
      id: 'faq-eligible',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'medium',
      text: 'Q: Who can apply? A: Any adult who rents a home in Alder County, is behind on rent or has received a notice from the landlord, and whose household income is within the program limit. Roommates who share a lease should submit one application per household.',
      plainText:
        'Q: Who can apply? A: Any adult who rents a home in Alder County, is behind on rent or has received a notice from the landlord, and whose household income is within the program limit. If you share a lease with roommates, send one application for the whole household.',
    },
    {
      id: 'faq-timeline',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: 'Q: How long does a decision take? A: Adjudication typically takes 15 to 20 business days from the date an application is deemed complete, exclusive of any period during which a request for clarification is outstanding. Where funds are approved, remittance to the landlord is initiated within 10 business days of the execution of the participation agreement.',
      plainText:
        'Q: How long does a decision take? A: Most decisions take 15 to 20 business days after your application is complete. Time spent waiting for you to answer a question is not counted. If the grant is approved, the county starts the payment to your landlord within 10 business days after your landlord signs the participation agreement.',
      terms: [{ term: 'business days', plain: 'Monday to Friday, not counting public holidays.' }],
    },
    {
      id: 'faq-coverage',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: "Q: Does the grant cover utility bills? A: Utility arrears are eligible only where the utility account is in the applicant's name, the arrearage relates to the same dwelling unit, and the service is water, sewer, gas or electricity. Telecommunications, internet and cable services are ineligible. Utility arrears are paid in addition to, not in place of, rental arrears and are subject to the same per-household maximum.",
      plainText:
        'Q: Does the grant cover utility bills? A: Sometimes. The grant can pay unpaid water, sewer, gas or electricity bills if the account is in your name and it is for the same home. It cannot pay phone, internet or cable bills. Utility bills can be paid as well as rent, but rent and utilities together count toward the same household limit.',
    },
    {
      id: 'faq-save-draft',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'simple',
      text: 'Q: Can I save my application and finish later? A: Yes. Use Save draft at any point. Drafts are kept for 30 days. Sign in with the same account to continue where you left off.',
    },
    {
      id: 'faq-obstacle',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: 'Q: What if my landlord will not sign the participation agreement? A: Landlord participation is a condition of disbursement. Where a landlord declines to execute the agreement, the Division will make up to two documented attempts to contact the landlord; if participation cannot be secured, the application will be closed without prejudice and the applicant will be referred to the Tenant Rights and Mediation Program.',
      plainText:
        'Q: What if my landlord will not sign the participation agreement? A: The grant cannot be paid unless your landlord signs. If your landlord refuses, county staff will try to reach them up to two times and keep a record of each attempt. If the landlord still refuses, your application is closed. This does not count against you, and the county will refer you to the Tenant Rights and Mediation Program for help.',
    },
    {
      id: 'faq-denied',
      kind: 'faq',
      importance: 'secondary',
      complexity: 'complex',
      text: 'Q: What if my application is denied? A: A written determination stating the reason for denial will be issued to the address of record. You may request reconsideration within 15 business days by submitting Form HSG-7, which is available under Forms. Reconsideration is conducted on the existing record; no new documents may be added. If the denial is upheld, you may not reapply for the same arrearage in the current funding cycle.',
      plainText:
        'Q: What if my application is denied? A: You will get a letter explaining why. If you disagree, you have 15 business days to ask for a review using Form HSG-7, which you can find under Forms. The review looks only at what you already sent; you cannot add new documents. If the review agrees with the denial, you cannot apply again for the same unpaid rent in this funding round.',
    },

    // ----------------------------------------------------------------- footer
    {
      id: 'nav-footer',
      kind: 'nav',
      importance: 'secondary',
      region: 'footer',
      items: [
        'About Alder County',
        'Privacy policy',
        'Terms of use',
        'Accessibility statement',
        'Public records request',
        'Site map',
      ],
    },
  ],
};
