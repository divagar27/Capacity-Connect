import { AssessmentStatus, CourseStatus, EnrollmentStatus, PrismaClient, Role, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertUser(input: {
  email: string;
  googleSub: string;
  name: string;
  role: Role | null;
  requestedRole?: Role;
  status: UserStatus;
  department: string;
  designation: string;
  employeeId: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    create: { ...input, lastLoginAt: null },
    update: {
      name: input.name,
      role: input.role,
      requestedRole: input.requestedRole,
      status: input.status,
      department: input.department,
      designation: input.designation,
      employeeId: input.employeeId,
    },
  });
}

async function addModule(courseId: string, title: string, order: number, lessons: { title: string; content: string; durationMins: number }[]) {
  const module = await prisma.courseModule.upsert({
    where: { id: `${courseId}-${order}` },
    create: { id: `${courseId}-${order}`, courseId, title, order },
    update: { title, order },
  });

  for (const [index, lesson] of lessons.entries()) {
    const lessonId = `${courseId}-${order}-${index + 1}`;
    await prisma.lesson.upsert({
      where: { id: lessonId },
      create: { id: lessonId, moduleId: module.id, ...lesson, order: index + 1 },
      update: { moduleId: module.id, ...lesson, order: index + 1 },
    });
  }
  return module;
}

async function addCourse(input: {
  id: string;
  title: string;
  description: string;
  subjectId: string;
  instructorId: string;
  level: string;
  durationMins: number;
  prerequisites: string[];
  learningObjectives: string[];
  capacity: number;
  competencyId: string;
  targetLevel: number;
  modules: { title: string; lessons: { title: string; content: string; durationMins: number }[] }[];
}) {
  const course = await prisma.course.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      instructorId: input.instructorId,
      level: input.level,
      durationMins: input.durationMins,
      prerequisites: input.prerequisites,
      learningObjectives: input.learningObjectives,
      capacity: input.capacity,
      status: CourseStatus.PUBLISHED,
    },
    update: {
      title: input.title,
      description: input.description,
      subjectId: input.subjectId,
      instructorId: input.instructorId,
      level: input.level,
      durationMins: input.durationMins,
      prerequisites: input.prerequisites,
      learningObjectives: input.learningObjectives,
      capacity: input.capacity,
      status: CourseStatus.PUBLISHED,
    },
  });

  await prisma.courseCompetency.upsert({
    where: { courseId_competencyId: { courseId: course.id, competencyId: input.competencyId } },
    create: { courseId: course.id, competencyId: input.competencyId, targetLevel: input.targetLevel },
    update: { targetLevel: input.targetLevel },
  });

  for (const [index, module] of input.modules.entries()) {
    await addModule(course.id, module.title, index + 1, module.lessons);
  }

  return course;
}

async function addAssessment(input: {
  id: string;
  title: string;
  subjectId: string;
  courseId: string;
  trainerId: string;
  questions: { prompt: string; topicTag: string; options: { text: string; isCorrect: boolean }[] }[];
}) {
  await prisma.questionnaire.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      title: input.title,
      subjectId: input.subjectId,
      courseId: input.courseId,
      trainerId: input.trainerId,
      durationMins: 10,
      passMark: 60,
      status: AssessmentStatus.PUBLISHED,
      questions: {
        create: input.questions.map((question) => ({
          prompt: question.prompt,
          topicTag: question.topicTag,
          points: 1,
          options: { create: question.options.map((option, order) => ({ ...option, order })) },
        })),
      },
    },
    update: {
      title: input.title,
      subjectId: input.subjectId,
      courseId: input.courseId,
      trainerId: input.trainerId,
      durationMins: 10,
      passMark: 60,
      status: AssessmentStatus.PUBLISHED,
    },
  });
}

async function main() {
  const admin = await upsertUser({
    email: 'admin@demo.local', googleSub: 'capacity-connect-demo-admin',
    name: 'Meera Iyer (Demo admin)', role: Role.ADMIN, status: UserStatus.ACTIVE,
    department: 'Sample Administration Unit', designation: 'Platform administrator', employeeId: 'DEMO-ADM-001',
  });
  const trainer = await upsertUser({
    email: 'trainer@demo.local', googleSub: 'capacity-connect-demo-trainer',
    name: 'Nikhil Sen (Demo trainer)', role: Role.TRAINER, status: UserStatus.ACTIVE,
    department: 'Sample Forecasting Division', designation: 'Training specialist', employeeId: 'DEMO-TRN-001',
  });
  const secondTrainer = await upsertUser({
    email: 'trainer.remote@demo.local', googleSub: 'capacity-connect-demo-trainer-remote',
    name: 'Leena Kapoor (Sample trainer)', role: Role.TRAINER, status: UserStatus.ACTIVE,
    department: 'Sample Observation Division', designation: 'Remote sensing specialist', employeeId: 'DEMO-TRN-002',
  });
  const trainee = await upsertUser({
    email: 'trainee@demo.local', googleSub: 'capacity-connect-demo-trainee',
    name: 'Asha Raman (Demo trainee)', role: Role.TRAINEE, status: UserStatus.ACTIVE,
    department: 'Sample Regional Centre', designation: 'Meteorological officer', employeeId: 'DEMO-TRA-001',
  });
  const participant = await upsertUser({
    email: 'participant@demo.local', googleSub: 'capacity-connect-demo-participant',
    name: 'Kiran Bose (Sample trainee)', role: Role.TRAINEE, status: UserStatus.ACTIVE,
    department: 'Sample Climate Services Unit', designation: 'Scientific assistant', employeeId: 'DEMO-TRA-002',
  });
  await upsertUser({
    email: 'pending@demo.local', googleSub: 'capacity-connect-demo-pending',
    name: 'Ravi Das (Pending sample account)', role: null, requestedRole: Role.TRAINER, status: UserStatus.PENDING,
    department: 'Sample Training Unit', designation: 'Training applicant', employeeId: 'DEMO-PND-001',
  });

  const competencyRows = [
    ['Data Analysis', 'Data & Technology'],
    ['Numerical Weather Prediction', 'Forecasting'],
    ['Remote Sensing', 'Observation'],
    ['Disaster Risk Communication', 'Communication'],
    ['Radar Meteorology', 'Observation'],
  ] as const;
  const competencies = new Map<string, string>();
  for (const [name, category] of competencyRows) {
    const competency = await prisma.skillTaxonomy.upsert({
      where: { name },
      create: { name, category },
      update: { category },
    });
    competencies.set(name, competency.id);
  }

  const traineeSkillId = competencies.get('Data Analysis')!;
  await prisma.userSkill.upsert({
    where: { userId_skillId: { userId: trainee.id, skillId: traineeSkillId } },
    create: { userId: trainee.id, skillId: traineeSkillId, proficiency: 2, targetProficiency: 4 },
    update: { proficiency: 2, targetProficiency: 4 },
  });
  for (const name of ['Radar Meteorology', 'Remote Sensing']) {
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId: trainee.id, skillId: competencies.get(name)! } },
      create: { userId: trainee.id, skillId: competencies.get(name)!, proficiency: 2 },
      update: { proficiency: 2 },
    });
  }

  const subjects = new Map<string, string>();
  const subjectRows = [
    ['Meteorological Data Analysis', 'MET-DA', 'Working with meteorological observations and environmental datasets.'],
    ['Numerical Weather Prediction', 'MET-NWP', 'Model guidance, forecast verification, and data assimilation.'],
    ['Remote Sensing', 'MET-RS', 'Satellite products and observational interpretation.'],
    ['Disaster Risk Communication', 'MET-DRC', 'Communicating warnings and risk information.'],
    ['Radar Meteorology', 'MET-RAD', 'Radar products, precipitation estimates, and severe weather analysis.'],
  ] as const;
  for (const [name, code, description] of subjectRows) {
    const subject = await prisma.subject.upsert({
      where: { code },
      create: { name, code, description },
      update: { name, description },
    });
    subjects.set(name, subject.id);
  }

  for (const [userId, skillName, proficiency] of [
    [trainer.id, 'Data Analysis', 4],
    [trainer.id, 'Radar Meteorology', 4],
    [trainer.id, 'Numerical Weather Prediction', 3],
    [secondTrainer.id, 'Remote Sensing', 5],
    [secondTrainer.id, 'Disaster Risk Communication', 3],
  ] as [string, string, number][]) {
    await prisma.userSkill.upsert({
      where: { userId_skillId: { userId, skillId: competencies.get(skillName)! } },
      create: { userId, skillId: competencies.get(skillName)!, proficiency },
      update: { proficiency },
    });
  }

  const courses = [
    {
      id: 'sample-data-statistics',
      title: 'Statistical Foundations for Environmental Data',
      description: 'Review descriptive statistics, distributions, and data quality checks used when preparing observational datasets.',
      subjectId: subjects.get('Meteorological Data Analysis')!, instructorId: trainer.id, level: 'BEGINNER', durationMins: 180,
      prerequisites: ['No prior coding required'], learningObjectives: ['Summarise a data series', 'Recognise missing and out-of-range observations'],
      capacity: 60, competencyId: traineeSkillId, targetLevel: 2,
      modules: [{ title: 'Preparing a reliable data series', lessons: [
        { title: 'Observation tables and units', content: 'Check the station, timestamp, unit, and quality flag before comparing observations.', durationMins: 15 },
        { title: 'Descriptive statistics', content: 'Use the mean, median, range, and quartiles to describe a sample. Compare the median when outliers may distort the mean.', durationMins: 20 },
      ] }],
    },
    {
      id: 'sample-python-analysis',
      title: 'Python for Meteorological Data Analysis',
      description: 'Use a small, reproducible Python workflow to inspect time series, handle missing values, and compare forecast output with observations.',
      subjectId: subjects.get('Meteorological Data Analysis')!, instructorId: trainer.id, level: 'INTERMEDIATE', durationMins: 240,
      prerequisites: ['Basic spreadsheet use', 'Statistical Foundations for Environmental Data'], learningObjectives: ['Load and inspect a time series', 'Calculate a forecast verification score'],
      capacity: 40, competencyId: traineeSkillId, targetLevel: 3,
      modules: [
        { title: 'Prepare a time series', lessons: [
          { title: 'Read and inspect tabular observations', content: 'Check column names, timestamps, units, and missing values before analysis. Keep a note of each transformation so the result can be reproduced.', durationMins: 20 },
          { title: 'Handle missing observations', content: 'Separate missing observations from valid zero values. Record the method used when filtering or filling gaps.', durationMins: 25 },
        ] },
        { title: 'Compare forecast and observation', lessons: [
          { title: 'Mean absolute error', content: 'For matched forecast and observation pairs, calculate the mean absolute error as the average of the absolute differences.', durationMins: 25 },
        ] },
      ],
    },
    {
      id: 'sample-applied-analysis',
      title: 'Applied Meteorological Data Analysis',
      description: 'Build an end-to-end analysis from data quality review to interpretation, including a clear account of uncertainty and limitations.',
      subjectId: subjects.get('Meteorological Data Analysis')!, instructorId: trainer.id, level: 'ADVANCED', durationMins: 300,
      prerequisites: ['Python for Meteorological Data Analysis'], learningObjectives: ['Compare observed and forecast distributions', 'Explain uncertainty and limitations in an analysis'],
      capacity: 30, competencyId: traineeSkillId, targetLevel: 4,
      modules: [
        { title: 'Verification and interpretation', lessons: [
          { title: 'Choose a verification measure', content: 'Select a measure suited to the forecast variable and question. State the sample period and any exclusions.', durationMins: 30 },
          { title: 'Communicate uncertainty', content: 'Describe data coverage, uncertainty, and known limitations alongside the result. A single summary score does not explain every forecast case.', durationMins: 30 },
        ] },
      ],
    },
    {
      id: 'sample-remote-sensing',
      title: 'Introduction to Satellite Remote Sensing',
      description: 'Interpret visible and infrared satellite products and connect imagery features with surface and atmospheric conditions.',
      subjectId: subjects.get('Remote Sensing')!, instructorId: secondTrainer.id, level: 'BEGINNER', durationMins: 210,
      prerequisites: ['Basic meteorology'], learningObjectives: ['Distinguish common satellite channels', 'Describe cloud features in imagery'],
      capacity: 50, competencyId: competencies.get('Remote Sensing')!, targetLevel: 3,
      modules: [{ title: 'Satellite products', lessons: [
        { title: 'Visible and infrared imagery', content: 'Visible imagery depends on reflected sunlight; infrared imagery represents emitted radiation and can be used at night.', durationMins: 20 },
        { title: 'Cloud features and context', content: 'Interpret cloud texture and temperature alongside location, time, and other observations.', durationMins: 25 },
      ] }],
    },
    {
      id: 'sample-risk-communication',
      title: 'Disaster Risk Communication',
      description: 'Practice writing clear, actionable warning messages that explain the hazard, likely impacts, and recommended action.',
      subjectId: subjects.get('Disaster Risk Communication')!, instructorId: secondTrainer.id, level: 'INTERMEDIATE', durationMins: 150,
      prerequisites: [], learningObjectives: ['Separate hazard information from recommended action', 'Use concise and accessible warning language'],
      capacity: 45, competencyId: competencies.get('Disaster Risk Communication')!, targetLevel: 3,
      modules: [{ title: 'Warning messages', lessons: [
        { title: 'Structure an actionable message', content: 'Name the hazard, affected place, expected timing, potential impact, and action in plain language.', durationMins: 20 },
        { title: 'Accessible language', content: 'Use short sentences, familiar terms, and clear action verbs. Avoid jargon where it does not help the reader act.', durationMins: 20 },
      ] }],
    },
  ];

  const seededCourses = new Map<string, { id: string; subjectId: string }>();
  for (const course of courses) {
    const created = await addCourse(course);
    seededCourses.set(course.id, { id: created.id, subjectId: created.subjectId });
  }

  await addAssessment({
    id: 'sample-data-statistics-assessment', title: 'Statistical Foundations Check',
    subjectId: subjects.get('Meteorological Data Analysis')!, courseId: 'sample-data-statistics', trainerId: trainer.id,
    questions: [
      { prompt: 'Before comparing observations, which details should be checked?', topicTag: 'Data quality', options: [
        { text: 'Station, timestamp, unit, and quality flag', isCorrect: true }, { text: 'Only the chart colour', isCorrect: false }, { text: 'Only the file name', isCorrect: false },
      ] },
      { prompt: 'Which summary can be useful when outliers distort a mean?', topicTag: 'Descriptive statistics', options: [
        { text: 'Median', isCorrect: true }, { text: 'File size', isCorrect: false }, { text: 'Number of column labels', isCorrect: false },
      ] },
    ],
  });
  await addAssessment({
    id: 'sample-python-analysis-assessment', title: 'Python Data Analysis Check',
    subjectId: subjects.get('Meteorological Data Analysis')!, courseId: 'sample-python-analysis', trainerId: trainer.id,
    questions: [
      { prompt: 'Before calculating a statistic from station observations, what should be checked first?', topicTag: 'Data quality', options: [
        { text: 'Units, timestamps, and quality flags', isCorrect: true }, { text: 'Only the file name', isCorrect: false }, { text: 'The colour of the chart', isCorrect: false },
      ] },
      { prompt: 'What does mean absolute error summarise?', topicTag: 'Forecast verification', options: [
        { text: 'The average magnitude of forecast errors', isCorrect: true }, { text: 'The direction of every error', isCorrect: false }, { text: 'The number of observations only', isCorrect: false },
      ] },
      { prompt: 'How should missing observations be treated?', topicTag: 'Data quality', options: [
        { text: 'Distinguished from valid zero values and documented', isCorrect: true }, { text: 'Always changed to zero', isCorrect: false }, { text: 'Ignored without recording the decision', isCorrect: false },
      ] },
    ],
  });
  await addAssessment({
    id: 'sample-applied-analysis-assessment', title: 'Applied Data Analysis Assessment',
    subjectId: subjects.get('Meteorological Data Analysis')!, courseId: 'sample-applied-analysis', trainerId: trainer.id,
    questions: [
      { prompt: 'What should accompany a summary verification score?', topicTag: 'Interpretation', options: [
        { text: 'The sample period, coverage, and limitations', isCorrect: true }, { text: 'A claim that it applies to every forecast case', isCorrect: false }, { text: 'Only the highest scoring case', isCorrect: false },
      ] },
      { prompt: 'When is it useful to compare median as well as mean?', topicTag: 'Descriptive statistics', options: [
        { text: 'When outliers may affect the mean', isCorrect: true }, { text: 'When there is only one observation', isCorrect: false }, { text: 'Never; the values are always identical', isCorrect: false },
      ] },
    ],
  });

  const foundations = await prisma.course.findUnique({
    where: { id: 'sample-data-statistics' },
    include: { modules: { orderBy: { order: 'asc' }, include: { lessons: { orderBy: { order: 'asc' } } } } },
  });
  const firstLesson = foundations?.modules[0]?.lessons[0];
  if (firstLesson) {
    for (const demoTrainee of [trainee, participant]) {
      await prisma.courseEnrollment.upsert({
        where: { userId_courseId: { userId: demoTrainee.id, courseId: 'sample-data-statistics' } },
        create: {
          userId: demoTrainee.id,
          courseId: 'sample-data-statistics',
          status: EnrollmentStatus.IN_PROGRESS,
          progress: 50,
          lessonProgress: [firstLesson.id],
        },
        update: {
          status: EnrollmentStatus.IN_PROGRESS,
          progress: 50,
          lessonProgress: [firstLesson.id],
          completedAt: null,
        },
      });
    }
  }

  for (const [userId, degree, field, institution, year] of [
    [trainer.id, 'M.Sc.', 'Environmental Data Science', 'Sample Institute of Earth Studies', 2012],
    [secondTrainer.id, 'M.Sc.', 'Remote Sensing', 'Sample Institute of Earth Studies', 2014],
  ] as [string, string, string, string, number][]) {
    const existing = await prisma.qualification.findFirst({ where: { userId, degree, field } });
    if (!existing) await prisma.qualification.create({ data: { userId, degree, field, institution, year } });
  }
  const experienceRows = [
    [trainer.id, 'Data quality and forecast verification', 2015, null],
    [secondTrainer.id, 'Satellite product interpretation', 2016, null],
  ] as [string, string, number, number | null][];
  for (const [userId, title, startYear, endYear] of experienceRows) {
    const existing = await prisma.workExperience.findFirst({ where: { userId, title } });
    if (!existing) {
      await prisma.workExperience.create({
        data: { userId, title, organization: 'Sample Meteorological Training Centre', startYear, endYear },
      });
    }
  }

  const notices = [
    {
      title: 'Sample programme: data analysis learning path',
      content: 'A sample pathway connects introductory statistics, Python workflows, and applied interpretation. Course content is demonstration material.',
      type: 'NEW_CONTENT' as const,
    },
    {
      title: 'Demo accounts and sample records',
      content: 'Profiles, courses, assessments, and participation shown in this environment are seeded examples for prototype evaluation.',
      type: 'NOTICE' as const,
    },
  ];
  for (const notice of notices) {
    const existing = await prisma.announcement.findFirst({ where: { title: notice.title } });
    if (!existing) await prisma.announcement.create({ data: { ...notice, pinned: notice.type === 'NEW_CONTENT' } });
  }

  console.log(`Seeded demo accounts and ${seededCourses.size} sample courses for Capacity Connect.`);
  console.log(`Demo roles: trainee@demo.local, trainer@demo.local, admin@demo.local`);
  console.log(`Admin sample account: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
