import { PrismaClient } from '@prisma/client'
import { hashSync } from 'bcryptjs'

const prisma = new PrismaClient({ log: ['error'] })

async function main() {
  // ─── Clean up existing sample data (idempotent seed) ──
  await prisma.auditLog.deleteMany({})
  await prisma.notification.deleteMany({})
  await prisma.announcement.deleteMany({})
  // Delete old demo users that may still exist
  const oldEmails = ['superadmin@umak.edu.ph', 'admin@umak.edu.ph', 'staff@umak.edu.ph']
  for (const email of oldEmails) {
    await prisma.user.deleteMany({ where: { email } })
  }

  // ─── Create specific user accounts ────────────
  const superAdmin = await prisma.user.upsert({
    where: { email: 'reinernuevas.acads@gmail.com' },
    update: {
      passwordHash: hashSync('@CSFDSARein03082026', 10),
      fullName: 'REINER NUEVAS',
      role: 'superadmin',
      status: 'active',
      profileImageUrl: null,
    },
    create: {
      email: 'reinernuevas.acads@gmail.com',
      passwordHash: hashSync('@CSFDSARein03082026', 10),
      fullName: 'REINER NUEVAS',
      givenName: 'Reiner',
      surname: 'Nuevas',
      role: 'superadmin',
      status: 'active',
      profileImageUrl: null,
    },
  })

  const adminDirector = await prisma.user.upsert({
    where: { email: 'adamos.pompeyoiii@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDDIRPoms03082026', 10),
      fullName: 'POMPEYO ADAMOS III',
      role: 'admin',
      status: 'active',
      profileImageUrl: '/profiles/pompeyo.png',
    },
    create: {
      email: 'adamos.pompeyoiii@umak.edu.ph',
      passwordHash: hashSync('@CSFDDIRPoms03082026', 10),
      fullName: 'POMPEYO ADAMOS III',
      givenName: 'Pompeyo',
      surname: 'Adamos III',
      role: 'admin',
      status: 'active',
      profileImageUrl: '/profiles/pompeyo.png',
    },
  })

  const adminStaff1 = await prisma.user.upsert({
    where: { email: 'mariafe.samares@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS1SAM03082026', 10),
      fullName: 'MARIA FE SAMARES-ROXAS',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/sam.png',
    },
    create: {
      email: 'mariafe.samares@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS1SAM03082026', 10),
      fullName: 'MARIA FE SAMARES-ROXAS',
      givenName: 'Maria Fe',
      surname: 'Samares-Roxas',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/sam.png',
    },
  })

  const adminStaff2 = await prisma.user.upsert({
    where: { email: 'alma.fraginal@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS2ALMA03082026', 10),
      fullName: 'ALMA FRAGINAL',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/alma.png',
    },
    create: {
      email: 'alma.fraginal@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS2ALMA03082026', 10),
      fullName: 'ALMA FRAGINAL',
      givenName: 'Alma',
      surname: 'Fraginal',
      role: 'staff',
      status: 'active',
      profileImageUrl: '/profiles/alma.png',
    },
  })

  const adminStaff3 = await prisma.user.upsert({
    where: { email: 'cbasilio@umak.edu.ph' },
    update: {
      passwordHash: hashSync('@CSFDAS3CATH03082026', 10),
      fullName: 'CATHERINE BASILIO',
      role: 'staff',
      status: 'active',
      profileImageUrl: null,
    },
    create: {
      email: 'cbasilio@umak.edu.ph',
      passwordHash: hashSync('@CSFDAS3CATH03082026', 10),
      fullName: 'CATHERINE BASILIO',
      givenName: 'Catherine',
      surname: 'Basilio',
      role: 'staff',
      status: 'active',
      profileImageUrl: null,
    },
  })

  console.log('User accounts created:', {
    superAdmin: superAdmin.id,
    adminDirector: adminDirector.id,
    adminStaff1: adminStaff1.id,
    adminStaff2: adminStaff2.id,
    adminStaff3: adminStaff3.id,
  })

  // ─── Create college/institute list ────────────
  const colleges = [
    'College of Liberal Arts and Sciences (CLAS)',
    'College of Business and Financial Science (CBFS)',
    'College of Computing and Information Sciences (CCIS)',
    'College of Continuing, Advanced and Professional Studies (CCAPS)',
    'College of Innovative Teacher Education (CITE)',
    'College of Innovative Teacher Education - Higher School ng UMak (CITE - HSU)',
    'College of Construction Sciences and Engineering (CCSE)',
    'College of Engineering Technology (CET)',
    'College of Governance and Public Policy (CGPP)',
    'College of Tourism and Hospitality Management (CTHM)',
    'Center of Human Kinesthetics (CHK)',
    'School of Law (SOL)',
    'Institute of Pharmacy (IOP)',
    'Institute of Nursing (ION)',
    'Institute of Imaging and Health Sciences (IIHS)',
    'Institute of Accountancy (IOA)',
    'Institute of Technical Education and Skills Training (ITEST)',
    'Institute of Social Development and Nation Building (ISDNB)',
    'Institute of Arts and Design (IAD)',
    'Institute of Psychology (IP)',
    'Institute of Social Work (ISW)',
    'Institute of Disaster and Emergency Management (IDEM)',
    'Other',
  ]

  for (let i = 0; i < colleges.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `college_${i}` },
      update: { value: colleges[i] },
      create: {
        id: `college_${i}`,
        listType: 'college_institute',
        label: colleges[i],
        value: colleges[i],
        sortOrder: i,
      },
    })
  }

  // ─── Minor violations ─────────────────────────
  const minorViolations = [
    'Not wearing ID',
    'Not wearing prescribed school uniform',
    'Wearing of incomplete uniform',
    'Cross Dressing (for gays/lesbians)',
    'Wearing non-prescribed shoes',
    'Wearing of slippers',
    'Wearing of miniskirts and shorts',
    'Make-Up (for males)',
    'Exhibiting rough behavior',
    'Using of vulgar/abusive/obscene language',
    'Loitering',
    'Littering',
    'Careless/unauthorized use of school property',
    'Hair Color',
    'Unauthorized posting of announcements',
    'Violation of traffic rules/Jaywalking',
    'Male dress code violations (earrings, cap inside classrooms, etc.)',
    'Female dress code violations (multiple earrings, sleeveless, etc.)',
    'General conduct violations',
  ]

  for (let i = 0; i < minorViolations.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `minor_${i}` },
      update: {},
      create: {
        id: `minor_${i}`,
        listType: 'violation_minor',
        label: minorViolations[i],
        sortOrder: i,
      },
    })
  }

  // ─── Major violations ─────────────────────────
  const majorViolations = [
    'Writing/Putting feet on tables/chairs/walls',
    'Gambling',
    'Shouting/creating noise',
    'Using/lending another person\'s ID/COR',
    'Using fake IDs/CORs',
    'Cheating during examination',
    'Oral defamation',
    'Vandalism',
    'Plagiarism',
    'Convictions by court',
    'Immoral/sex-related acts/abortion',
    'Serious physical injury',
    'Theft',
    'Negligence of Duty',
    'Grave Act of Disrespect',
    'Serious Dishonesty',
    'Damaging university property',
    'Illegal assembly',
    'Possession/distribution of pornographic material',
    'Possession/smoking of cigarettes',
    'Tampering of student ID',
    'Unauthorized possession of exam materials',
    'Public Display of Affection',
    'Entering campus under influence',
    'Having someone take exam for another',
    'Bribing/receiving bribes',
    'Misappropriation of organization funds',
    'Hazing',
    'Involvement in rumble/fist fighting/armed combat',
    'Unauthorized collection/extortion',
    'Carrying/possession of firearms',
    'Membership in unrecognized organizations',
    'Drug law violations',
    'Gross Negligence',
    'Indiscriminate use of musical instruments/gadgets',
    'Portrayal of untoward behavior',
    'Grave disrespect to university officials',
    'Direct physical assault',
    'Anti-Hazing Act violations',
    'Exhibiting/exposing nude or half-naked content',
    'Forging/falsifying academic records',
    'Actions dishonoring the university',
    'Faculty Evaluation violations',
    'Wearing unauthorized lanyards (Unofficial)',
    'Wearing unauthorized fraternity insignia (Unofficial)',
  ]

  for (let i = 0; i < majorViolations.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `major_${i}` },
      update: {},
      create: {
        id: `major_${i}`,
        listType: 'violation_major',
        label: majorViolations[i],
        sortOrder: i,
      },
    })
  }

  // ─── Other violations ────────────────────────
  const otherViolations = [
    'Late Enrollment',
    'Late Payment',
    'Late Faculty Evaluation',
  ]

  for (let i = 0; i < otherViolations.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `violation_other_${i}` },
      update: {},
      create: {
        id: `violation_other_${i}`,
        listType: 'violation_other',
        label: otherViolations[i],
        sortOrder: i,
      },
    })
  }

  // ─── Complaint categories ─────────────────────
  const complaintCategories = [
    'Academic Issues',
    'Behavioral Concerns',
    'Bullying/Harassment',
    'Discrimination',
    'Property Damage',
    'Safety & Security',
    'Sexual Harassment',
    'Theft/Robbery',
    'Vandalism',
    'Violence/Threats',
    'Others',
  ]

  for (let i = 0; i < complaintCategories.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `complaint_cat_${i}` },
      update: {},
      create: {
        id: `complaint_cat_${i}`,
        listType: 'complaint_category',
        label: complaintCategories[i],
        sortOrder: i,
      },
    })
  }

  // ─── FAQ items ────────────────────────────────
  const faqs = [
    { q: 'What is CSFD?', a: 'The Center for Student Formation and Discipline (CSFD) is the office responsible for promoting student welfare, discipline, and character formation at the University of Makati.' },
    { q: 'How do I file a complaint?', a: 'You can file a complaint through our online complaint form available on this website. No login is required. You will receive a complaint number to track the status of your case.' },
    { q: 'How do I request a Good Moral Certificate?', a: 'You can submit a Good Moral Certificate request through our Services page. Choose your classification (Currently Enrolled, Graduate/Alumni, or Non-completer) and fill out the required information.' },
    { q: 'What are the office hours of CSFD?', a: 'CSFD processes requests Monday to Friday, 8:00 AM to 5:00 PM. However, you may submit online requests 24/7 and they will be processed during office hours.' },
    { q: 'How can I track my request?', a: 'Use the Track page on this website. Enter your request number (e.g., GMC-2025-00001) or complaint number (e.g., CMP-2025-00001) along with your tracking token.' },
    { q: 'What is a Uniform Exemption Request?', a: 'A Uniform Exemption Request allows students to be exempted from wearing the prescribed school uniform due to valid reasons such as medical conditions or employment.' },
    { q: 'How long does it take to process a Good Moral Certificate?', a: 'Processing time varies depending on the volume of requests. You will receive email updates on the status of your request. Typically, it takes 3-5 working days.' },
    { q: 'What happens after I file a complaint?', a: 'After filing, CSFD staff will review and evaluate your complaint. You will receive notifications via email about the status of your case, including any required actions on your part.' },
    { q: 'Can I file a complaint anonymously?', a: 'No, you need to provide your personal information when filing a complaint. However, your information is kept confidential and is only accessible to CSFD staff.' },
    { q: 'What is a Cross-Dressing Clearance?', a: 'A Cross-Dressing Clearance is required for students who need to wear attire that does not conform to the prescribed dress code for a specific event or activity.' },
  ]

  for (let i = 0; i < faqs.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `faq_${i}` },
      update: {},
      create: {
        id: `faq_${i}`,
        listType: 'faq',
        label: faqs[i].q,
        value: faqs[i].a,
        sortOrder: i,
      },
    })
  }

  // ─── Office hours ─────────────────────────────
  await prisma.managedList.upsert({
    where: { id: 'office_hours_1' },
    update: {},
    create: {
      id: 'office_hours_1',
      listType: 'office_hours',
      label: 'Monday-Friday',
      value: '8:00 AM - 5:00 PM',
      sortOrder: 0,
    },
  })

  // ─── Year/Grade levels ────────────────────────
  const yearLevels = ['Grade 11', 'Grade 12', 'First Year Level', 'Second Year Level', 'Third Year Level', 'Fourth Year Level', 'Fifth Year Level']
  for (let i = 0; i < yearLevels.length; i++) {
    await prisma.managedList.upsert({
      where: { id: `year_${i}` },
      update: {},
      create: {
        id: `year_${i}`,
        listType: 'year_level',
        label: yearLevels[i],
        sortOrder: i,
      },
    })
  }

  // ─── Create sample announcements ──────────────
  await prisma.announcement.create({
    data: {
      title: 'Welcome to iCSFD+ Online Portal',
      body: 'We are pleased to announce the launch of the iCSFD+ Integrated CSFD Digital Management System. Students can now file complaints and request services online, 24/7. Processing of requests will still be done during office hours (Monday-Friday, 8AM-5PM).',
      postedFrom: new Date(),
      postedTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      visibility: 'All',
      isPinned: true,
      createdById: superAdmin.id,
    },
  })

  await prisma.announcement.create({
    data: {
      title: 'Good Moral Certificate Processing Schedule',
      body: 'Please be informed that processing of Good Moral Certificates may take 3-5 working days. Ensure all required documents are uploaded before submitting your request.',
      postedFrom: new Date(),
      postedTo: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      visibility: 'All',
      isPinned: false,
      createdById: adminDirector.id,
    },
  })

  // ─── Form Sections & Questions ─────────────────
  // Only seed if no form questions exist yet
  const existingQs = await prisma.formQuestion.count()
  if (existingQs === 0) {
    console.log('Seeding default complaint form structure...')

    // ── Instructions Phase ──
    const instrSection = await prisma.formSection.create({
      data: {
        phase: 'instructions',
        title: 'Instructions',
        description: 'Please read the following guidelines before filing your complaint.',
        sortOrder: 0,
      },
    })

    await prisma.formQuestion.create({
      data: {
        id: 'instr_header',
        phase: 'instructions',
        fieldType: 'section_header',
        label: 'Complaint Filing Guidelines',
        content: `<p>Welcome to the <strong>iCSFD+ Online Complaint Form</strong>. Before proceeding, please ensure the following:</p>
<ul>
<li>All information provided must be <strong>accurate and truthful</strong>.</li>
<li>Provide as much detail as possible about the incident.</li>
<li>Upload supporting evidence if available (documents, photos, etc.).</li>
<li>Your complaint will be reviewed by CSFD staff during office hours.</li>
<li>You will receive a <strong>complaint number</strong> and <strong>tracking token</strong> to monitor your case.</li>
</ul>
<p><em>All information is kept confidential and accessible only to authorized CSFD personnel.</em></p>`,
        sortOrder: 0,
        sectionId: instrSection.id,
      },
    })

    // ── Complainant Phase ──
    const compInfoSection = await prisma.formSection.create({
      data: {
        phase: 'complainant',
        title: 'Personal Information',
        sortOrder: 0,
      },
    })

    const compAcadSection = await prisma.formSection.create({
      data: {
        phase: 'complainant',
        title: 'Academic Information',
        sortOrder: 1,
      },
    })

    // Complainant - Personal Info questions (use well-known IDs for backward compat)
    await prisma.formQuestion.createMany({
      data: [
        { id: 'comp_info_header', phase: 'complainant', fieldType: 'section_header', label: 'Personal Information', sectionId: compInfoSection.id, sortOrder: 0 },
        { id: 'givenName', phase: 'complainant', fieldType: 'short_text', label: 'Given Name', required: true, placeholder: 'Enter given name', sectionId: compInfoSection.id, sortOrder: 1, roleTarget: 'both' },
        { id: 'surname', phase: 'complainant', fieldType: 'short_text', label: 'Surname', required: true, placeholder: 'Enter surname', sectionId: compInfoSection.id, sortOrder: 2, roleTarget: 'both' },
        { id: 'middleName', phase: 'complainant', fieldType: 'short_text', label: 'Middle Name', placeholder: 'Enter middle name', sectionId: compInfoSection.id, sortOrder: 3, roleTarget: 'both' },
        { id: 'extensionName', phase: 'complainant', fieldType: 'short_text', label: 'Extension Name', placeholder: 'e.g., Jr., Sr., III', sectionId: compInfoSection.id, sortOrder: 4, roleTarget: 'both' },
      ],
    })

    await prisma.formQuestion.createMany({
      data: [
        { id: 'comp_acad_header', phase: 'complainant', fieldType: 'section_header', label: 'Academic Information', sectionId: compAcadSection.id, sortOrder: 5 },
        { id: 'sex', phase: 'complainant', fieldType: 'radio', label: 'Sex', required: true, choices: '[{"label":"Male","value":"Male"},{"label":"Female","value":"Female"}]', sectionId: compAcadSection.id, sortOrder: 6, roleTarget: 'both' },
        { id: 'studentNumber', phase: 'complainant', fieldType: 'short_text', label: 'Student Number', placeholder: 'e.g., K12345678', helpText: 'Letter followed by numbers (e.g., K12345678)', sectionId: compAcadSection.id, sortOrder: 7, roleTarget: 'both' },
        { id: 'yearLevel', phase: 'complainant', fieldType: 'dropdown', label: 'Year Level', choices: 'dynamic:year_level', sectionId: compAcadSection.id, sortOrder: 8, roleTarget: 'both' },
        { id: 'collegeInstitute', phase: 'complainant', fieldType: 'dropdown', label: 'College/Institute', choices: 'dynamic:college_institute', sectionId: compAcadSection.id, sortOrder: 9, roleTarget: 'both' },
        { id: 'email', phase: 'complainant', fieldType: 'email', label: 'Email Address', required: true, placeholder: 'Enter email address', sectionId: compAcadSection.id, sortOrder: 10, roleTarget: 'both' },
      ],
    })

    // ── Respondent Phase ──
    const respInfoSection = await prisma.formSection.create({
      data: {
        phase: 'respondent',
        title: 'Personal Information',
        sortOrder: 0,
      },
    })

    const respAcadSection = await prisma.formSection.create({
      data: {
        phase: 'respondent',
        title: 'Academic Information',
        sortOrder: 1,
      },
    })

    await prisma.formQuestion.createMany({
      data: [
        { id: 'resp_info_header', phase: 'respondent', fieldType: 'section_header', label: 'Personal Information', sectionId: respInfoSection.id, sortOrder: 0 },
        { id: 'resp_givenName', phase: 'respondent', fieldType: 'short_text', label: 'Given Name', required: true, placeholder: 'Enter given name', sectionId: respInfoSection.id, sortOrder: 1, roleTarget: 'both' },
        { id: 'resp_surname', phase: 'respondent', fieldType: 'short_text', label: 'Surname', required: true, placeholder: 'Enter surname', sectionId: respInfoSection.id, sortOrder: 2, roleTarget: 'both' },
        { id: 'resp_middleName', phase: 'respondent', fieldType: 'short_text', label: 'Middle Name', placeholder: 'Enter middle name', sectionId: respInfoSection.id, sortOrder: 3, roleTarget: 'both' },
        { id: 'resp_extensionName', phase: 'respondent', fieldType: 'short_text', label: 'Extension Name', placeholder: 'e.g., Jr., Sr., III', sectionId: respInfoSection.id, sortOrder: 4, roleTarget: 'both' },
      ],
    })

    await prisma.formQuestion.createMany({
      data: [
        { id: 'resp_acad_header', phase: 'respondent', fieldType: 'section_header', label: 'Academic Information', sectionId: respAcadSection.id, sortOrder: 5 },
        { id: 'resp_sex', phase: 'respondent', fieldType: 'radio', label: 'Sex', required: true, choices: '[{"label":"Male","value":"Male"},{"label":"Female","value":"Female"}]', sectionId: respAcadSection.id, sortOrder: 6, roleTarget: 'both' },
        { id: 'resp_studentNumber', phase: 'respondent', fieldType: 'short_text', label: 'Student Number', placeholder: 'e.g., K12345678', helpText: 'Letter followed by numbers (e.g., K12345678)', sectionId: respAcadSection.id, sortOrder: 7, roleTarget: 'both' },
        { id: 'resp_yearLevel', phase: 'respondent', fieldType: 'dropdown', label: 'Year Level', choices: 'dynamic:year_level', sectionId: respAcadSection.id, sortOrder: 8, roleTarget: 'both' },
        { id: 'resp_collegeInstitute', phase: 'respondent', fieldType: 'dropdown', label: 'College/Institute', choices: 'dynamic:college_institute', sectionId: respAcadSection.id, sortOrder: 9, roleTarget: 'both' },
        { id: 'resp_email', phase: 'respondent', fieldType: 'email', label: 'Email Address', placeholder: 'Enter email address', sectionId: respAcadSection.id, sortOrder: 10, roleTarget: 'both' },
      ],
    })

    // ── Complaint Details Phase ──
    const classSection = await prisma.formSection.create({
      data: {
        phase: 'complaint_details',
        title: 'Classification',
        description: 'Select the complaint category and violation type.',
        sortOrder: 0,
      },
    })

    const incidentSection = await prisma.formSection.create({
      data: {
        phase: 'complaint_details',
        title: 'Incident Information',
        description: 'Provide details about when and where the incident occurred.',
        sortOrder: 1,
      },
    })

    const descSection = await prisma.formSection.create({
      data: {
        phase: 'complaint_details',
        title: 'Narrative',
        description: 'Describe the incident and the outcome you are seeking.',
        sortOrder: 2,
      },
    })

    const additionalSection = await prisma.formSection.create({
      data: {
        phase: 'complaint_details',
        title: 'Additional Information',
        description: 'Any additional details that may help in the investigation.',
        sortOrder: 3,
      },
    })

    const evidenceSection = await prisma.formSection.create({
      data: {
        phase: 'complaint_details',
        title: 'Supporting Evidence',
        description: 'Upload any documents, photos, or other evidence related to the complaint.',
        sortOrder: 4,
      },
    })

    await prisma.formQuestion.createMany({
      data: [
        // Classification section
        { id: 'complaintCategory', phase: 'complaint_details', fieldType: 'dropdown', label: 'Complaint Category', required: true, choices: 'dynamic:complaint_category', placeholder: 'Select complaint category', sectionId: classSection.id, sortOrder: 0 },
        { id: 'violationType', phase: 'complaint_details', fieldType: 'dropdown', label: 'Violation Type', required: true, placeholder: 'Select violation type', sectionId: classSection.id, sortOrder: 1 },

        // Incident Information section
        { id: 'subject', phase: 'complaint_details', fieldType: 'short_text', label: 'Subject', required: true, placeholder: 'Brief summary of the complaint', sectionId: incidentSection.id, sortOrder: 0 },
        { id: 'dateOfIncident', phase: 'complaint_details', fieldType: 'date', label: 'Date of Incident', required: true, sectionId: incidentSection.id, sortOrder: 1 },
        { id: 'location', phase: 'complaint_details', fieldType: 'short_text', label: 'Location', required: true, placeholder: 'Where did the incident occur?', sectionId: incidentSection.id, sortOrder: 2 },
        { id: 'isOngoing', phase: 'complaint_details', fieldType: 'radio', label: 'Is this an ongoing issue?', required: true, choices: '[{"label":"Yes","value":"Yes"},{"label":"No","value":"No"}]', sectionId: incidentSection.id, sortOrder: 3 },
        { id: 'howOften', phase: 'complaint_details', fieldType: 'short_text', label: 'How often does this occur?', placeholder: 'e.g., Daily, Weekly, Once', sectionId: incidentSection.id, sortOrder: 4 },

        // Narrative section
        { id: 'description', phase: 'complaint_details', fieldType: 'long_text', label: 'Description', required: true, placeholder: 'Describe the incident in detail (at least 20 characters)', validation: '{"min":20,"customMessage":"Description must be at least 20 characters"}', sectionId: descSection.id, sortOrder: 0 },
        { id: 'desiredOutcome', phase: 'complaint_details', fieldType: 'long_text', label: 'Desired Outcome', placeholder: 'What resolution are you seeking?', sectionId: descSection.id, sortOrder: 1 },

        // Additional Information section
        { id: 'witnesses', phase: 'complaint_details', fieldType: 'long_text', label: 'Witnesses', placeholder: 'Names and contact information of any witnesses', sectionId: additionalSection.id, sortOrder: 0 },
        { id: 'previousReports', phase: 'complaint_details', fieldType: 'long_text', label: 'Previous Reports', placeholder: 'Have you reported this before? If so, provide details.', sectionId: additionalSection.id, sortOrder: 1 },

        // Supporting Evidence section
        { id: 'evidence_upload', phase: 'complaint_details', fieldType: 'file_upload', label: 'Supporting Evidence (Optional)', helpText: 'PDF, DOC, DOCX, JPG, PNG, GIF (max 10MB each, up to 5 files)', sectionId: evidenceSection.id, sortOrder: 0 },
      ],
    })

    console.log('Default complaint form structure seeded!')
  } else {
    console.log(`Form questions already exist (${existingQs} records), skipping form seed.`)
  }

  // ─── Service Toggles ───────────────────────────
  const serviceToggles = [
    { key: 'GMC', name: 'Good Moral Certificate', desc: 'Request a Good Moral Certificate from CSFD' },
    { key: 'UER', name: 'Uniform Exemption Request', desc: 'Request exemption from wearing the prescribed uniform' },
    { key: 'CDC', name: 'Cross-Dressing Clearance', desc: 'Request clearance for cross-dressing attire' },
    { key: 'CAC', name: 'Child Admission Clearance', desc: 'Request child admission clearance' },
    { key: 'COMPLAINT', name: 'Complaint Filing', desc: 'File a complaint through the online form' },
    { key: 'DISCIPLINARY', name: 'Disciplinary Records', desc: 'View and manage disciplinary records' },
  ]

  for (const svc of serviceToggles) {
    await prisma.serviceToggle.upsert({
      where: { serviceKey: svc.key },
      update: {},
      create: {
        serviceKey: svc.key,
        serviceName: svc.name,
        description: svc.desc,
        isActive: true,
      },
    })
  }

  console.log('Seed data completed successfully!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
