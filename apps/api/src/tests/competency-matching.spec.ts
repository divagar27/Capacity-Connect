import { Test, TestingModule } from '@nestjs/testing';
import { CompetencyService } from '../modules/competency/competency.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@capacity-connect/shared';

describe('CompetencyService (Deterministic, Explainable Matching)', () => {
  let service: CompetencyService;
  let prisma: PrismaService;

  const mockTrainers = [
    {
      id: 'trainer-radar-expert',
      name: 'Dr. Radar Specialist',
      email: 'radar@sample.local',
      department: 'Radar Division',
      designation: 'Scientist-F',
      role: Role.TRAINER,
      status: 'ACTIVE',
      userSkills: [
        {
          proficiency: 5,
          skill: { name: 'Doppler Weather Radar (DWR)', category: 'Radar Meteorology' },
        },
      ],
      qualifications: [
        { degree: 'Ph.D.', field: 'Radar Atmospheric Physics', institution: 'IIT Delhi', year: 2012 },
      ],
      certificates: [
        { title: 'WMO Radar Operations', issuingBody: 'WMO', issueYear: 2016 },
      ],
      workExperiences: [
        { title: 'Radar Meteorologist', organization: 'IMD', startYear: 2010, endYear: 2020 },
        { title: 'Senior Radar Meteorologist', organization: 'IMD', startYear: 2018, endYear: 2026 }, // Overlapping period!
      ],
      createdCourses: [
        { title: 'DWR Radar Interpretation', status: 'PUBLISHED', level: 'ADVANCED', subject: { name: 'Radar Meteorology' } },
      ],
      trainerFeedbacks: [
        { rating: 5 },
        { rating: 5 },
        { rating: 4 },
      ],
    },
    {
      id: 'trainer-nwp-expert',
      name: 'Dr. NWP Specialist',
      email: 'nwp@sample.local',
      department: 'NWP Division',
      designation: 'Scientist-E',
      role: Role.TRAINER,
      status: 'ACTIVE',
      userSkills: [
        {
          proficiency: 5,
          skill: { name: 'Numerical Weather Prediction WRF', category: 'Dynamical Modeling' },
        },
      ],
      qualifications: [
        { degree: 'Ph.D.', field: 'Dynamical Modeling', institution: 'CUSAT', year: 2015 },
      ],
      certificates: [],
      workExperiences: [
        { title: 'Modeler', organization: 'NCMRWF', startYear: 2016, endYear: 2026 },
      ],
      createdCourses: [
        { title: 'WRF Modeling Essentials', status: 'PUBLISHED', level: 'INTERMEDIATE', subject: { name: 'Numerical Weather Prediction' } },
      ],
      trainerFeedbacks: [], // ZERO feedback baseline!
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetencyService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findMany: jest.fn().mockResolvedValue(mockTrainers),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CompetencyService>(CompetencyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('ranks Radar expert higher when subject is Radar', async () => {
    const rankings = await service.rankTrainersBySubject('Radar');

    expect(rankings.length).toBe(2);
    expect(rankings[0].trainerId).toBe('trainer-radar-expert');
    expect(rankings[0].matchScore).toBeGreaterThan(rankings[1].matchScore);
    expect(rankings[0].breakdown.relevantQualifications.evidenceType).toBe('SELF_DECLARED');
    expect(rankings[0].breakdown.publishedCourseHistory.evidenceType).toBe('PLATFORM_RECORDED');
    expect(rankings[0].evidenceSummary.platformRecordedCount).toBe(2);
  });

  it('ranks NWP expert higher when subject is NWP', async () => {
    const rankings = await service.rankTrainersBySubject('NWP');

    expect(rankings.length).toBe(2);
    expect(rankings[0].trainerId).toBe('trainer-nwp-expert');
    expect(rankings[0].matchScore).toBeGreaterThan(rankings[1].matchScore);
  });

  it('merges overlapping work experiences without double-counting years', async () => {
    const rankings = await service.rankTrainersBySubject('Radar');
    const radarTrainer = rankings.find((r) => r.trainerId === 'trainer-radar-expert');

    // 2010 to 2020 + 2018 to 2026 merged should span 2010 to 2026 = 17 years, not (11 + 9 = 20)
    expect(radarTrainer?.breakdown.relevantExperience.details.some((d) => d.includes('17 years'))).toBe(true);
  });

  it('enforces ZERO feedback baseline when no reviews exist instead of substituting fake high ratings', async () => {
    const rankings = await service.rankTrainersBySubject('NWP');
    const nwpTrainer = rankings.find((r) => r.trainerId === 'trainer-nwp-expert');

    expect(nwpTrainer?.breakdown.learnerFeedback.points).toBe(0);
    expect(nwpTrainer?.breakdown.learnerFeedback.evidenceType).toBe('MISSING');
  });
});
