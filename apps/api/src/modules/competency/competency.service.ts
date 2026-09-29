import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@capacity-connect/shared';

export interface ScoreEvidence {
  weight: string;
  points: number;
  maxPoints: number;
  evidenceType: 'SELF_DECLARED' | 'PLATFORM_RECORDED' | 'MISSING';
  summary: string;
  details: string[];
}

export interface TrainerRecommendation {
  trainerId: string;
  name: string;
  email: string;
  isSample: boolean;
  department: string | null;
  designation: string | null;
  matchScore: number; // 0 - 100
  evidenceSummary: {
    platformRecordedCount: number;
    selfDeclaredCount: number;
    missingCount: number;
  };
  breakdown: {
    relevantSkills: ScoreEvidence;
    relevantQualifications: ScoreEvidence;
    relevantExperience: ScoreEvidence;
    publishedCourseHistory: ScoreEvidence;
    learnerFeedback: ScoreEvidence;
  };
}

@Injectable()
export class CompetencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build a transparent pathway from the trainee's saved proficiency and course mappings.
   * No ranking model or generated content is involved: competencies match by taxonomy ID,
   * and each course states the level it is designed to support.
   */
  async getLearningPath(userId: string) {
    const [skills, courses] = await Promise.all([
      this.prisma.userSkill.findMany({
        where: { userId },
        include: { skill: true },
        orderBy: { skill: { name: 'asc' } },
      }),
      this.prisma.course.findMany({
        where: { status: 'PUBLISHED' },
        include: {
          subject: true,
          instructor: { select: { id: true, name: true, designation: true } },
          competencies: { include: { competency: true } },
          modules: { select: { id: true, title: true, lessons: { select: { id: true } } } },
          questionnaires: { where: { status: 'PUBLISHED' }, select: { id: true, title: true, deadline: true } },
          enrollments: { where: { userId }, include: { certificate: true } },
        },
      }),
    ]);

    return skills
      .filter((skill) => skill.targetProficiency != null && skill.proficiency < skill.targetProficiency)
      .map((skill) => {
        const currentLevel = skill.proficiency;
        const targetLevel = skill.targetProficiency as number;
        const pathway = courses
          .flatMap((course) => course.competencies
            .filter((mapping) => mapping.competencyId === skill.skillId
              && mapping.targetLevel > currentLevel
              && mapping.targetLevel <= targetLevel)
            .map((mapping) => {
              const enrollment = course.enrollments[0];
              return {
                courseId: course.id,
                title: course.title,
                description: course.description,
                subject: course.subject.name,
                level: course.level,
                durationMins: course.durationMins,
                prerequisites: course.prerequisites,
                learningObjectives: course.learningObjectives,
                targetLevel: mapping.targetLevel,
                trainer: course.instructor,
                modules: course.modules,
                assessment: course.questionnaires[0] || null,
                enrollment: enrollment ? {
                  id: enrollment.id,
                  status: enrollment.status,
                  progress: enrollment.progress,
                  certificateIssued: Boolean(enrollment.certificate),
                } : null,
                reason: `Mapped to ${skill.skill.name}; designed to progress proficiency from level ${currentLevel} toward level ${targetLevel}.`,
              };
            }))
          .sort((a, b) => a.targetLevel - b.targetLevel || a.durationMins - b.durationMins);

        return {
          competencyId: skill.skillId,
          competency: skill.skill.name,
          category: skill.skill.category,
          currentLevel,
          targetLevel,
          gap: targetLevel - currentLevel,
          pathway,
        };
      });
  }

  /**
   * Deterministic, explainable competency ranking for subject matter experts.
   *
   * Weights & Philosophy:
   * - 30% Subject Skills (Direct taxonomy matches, self-declared proficiency 1-5)
   * - 25% Relevant Qualifications (self-declared profile records)
   * - 20% Non-overlapping Work Experience (self-declared profile records)
   * - 15% Published Course History (platform records)
   * - 10% Learner Feedback (platform records with sample-size weighting)
   */
  async rankTrainersBySubject(subjectName: string): Promise<TrainerRecommendation[]> {
    const subjectLower = (subjectName || 'Meteorology').trim().toLowerCase();

    // Domain keywords mapping for high-fidelity deterministic matching
    const domainKeywords: Record<string, string[]> = {
      radar: ['radar', 'dwr', 'doppler', 'reflectivity', 'dual-pol', 'dual polarization'],
      nwp: ['nwp', 'numerical weather', 'wrf', 'dynamical modeling', 'dynamical', 'modeling', 'assimilation', 'forecasting model', 'ncmrwf'],
      satellite: ['satellite', 'insat', 'gisat', 'radiometer', 'remote sensing', 'sounder'],
      cyclone: ['cyclone', 'tropical cyclone', 'vortex', 'storm surge', 'depression', 'track prediction'],
      hydrometeorology: ['hydrometeorology', 'flood', 'precipitation', 'rainfall', 'river basin', 'qpe', 'monsoon'],
    };

    const targetKeywords = Object.entries(domainKeywords).find(([key]) => subjectLower.includes(key))?.[1] || [subjectLower];

    const isMatch = (text: string) => {
      const lower = text.toLowerCase();
      return targetKeywords.some((kw) => lower.includes(kw));
    };

    let trainers = await this.prisma.user.findMany({
      where: {
        role: Role.TRAINER,
        status: 'ACTIVE',
      },
      include: {
        userSkills: { include: { skill: true } },
        qualifications: true,
        certificates: true,
        workExperiences: true,
        createdCourses: {
          include: { subject: true },
        },
        trainerFeedbacks: true,
      },
    });

    const recommendations: TrainerRecommendation[] = trainers.map((trainer) => {
      // -----------------------------------------------------------------------
      // 1. Relevant Skills (30% weight) - Self-declared with taxonomy match
      // -----------------------------------------------------------------------
      const matchingSkills = trainer.userSkills.filter((us) => {
        const sName = us.skill.name.toLowerCase();
        const sCat = us.skill.category.toLowerCase();
        return isMatch(sName) || isMatch(sCat);
      });

      let skillPoints = 0;
      const skillDetails: string[] = [];
      let skillEvidenceType: 'SELF_DECLARED' | 'MISSING' = 'MISSING';

      if (matchingSkills.length > 0) {
        skillEvidenceType = 'SELF_DECLARED';
        const bestProficiency = Math.max(...matchingSkills.map((s) => s.proficiency)); // 1 to 5
        skillPoints = Number(((bestProficiency / 5.0) * 30).toFixed(1));
        matchingSkills.forEach((s) => {
          skillDetails.push(`${s.skill.name} (Proficiency Level: ${s.proficiency}/5, Category: ${s.skill.category})`);
        });
      } else {
        skillPoints = 0;
        skillDetails.push(`No declared skills matched "${subjectName}" in user taxonomy profile.`);
      }

      // -----------------------------------------------------------------------
      // 2. Relevant Qualifications (25% weight) - self-declared degrees and certificates
      // This application does not verify credentials.
      // -----------------------------------------------------------------------
      const relevantQuals = trainer.qualifications.filter((q) => {
        const text = `${q.degree} ${q.field}`;
        return isMatch(text);
      });

      const relevantCerts = trainer.certificates.filter((c) => {
        const text = c.title;
        return isMatch(text);
      });

      const credentialCount = relevantQuals.length + relevantCerts.length;
      const credentialPoints = Math.min(25, Number((Math.min(credentialCount, 5) * 5).toFixed(1)));
      const credentialDetails: string[] = [];

      relevantQuals.forEach((q) => {
        credentialDetails.push(`Self-declared degree: ${q.degree} in ${q.field} (${q.institution}, ${q.year})`);
      });
      relevantCerts.forEach((c) => {
        credentialDetails.push(`Self-declared certificate: ${c.title} (${c.issuingBody}, ${c.issueYear})`);
      });

      if (credentialCount === 0) {
        credentialDetails.push('No matching qualification or certificate recorded in the profile.');
      }

      // -----------------------------------------------------------------------
      // 3. Non-Overlapping Work Experience (20% weight) - Merged intervals
      // Rule: Weight domain-relevant operational duties higher than general service
      // -----------------------------------------------------------------------
      const currentYear = new Date().getFullYear();
      const intervals = trainer.workExperiences
        .map((we) => ({
          start: we.startYear,
          end: Math.min(currentYear, we.endYear || currentYear),
          org: we.organization,
          title: we.title,
          isRelevant: isMatch(`${we.title} ${we.organization}`),
        }))
        .filter((iv) => iv.start <= iv.end)
        .sort((a, b) => a.start - b.start);

      // Merge overlapping intervals to prevent double-counting
      let mergedYears = 0;
      let relevantYears = 0;
      const mergedIntervals: { start: number; end: number; isRelevant: boolean }[] = [];
      for (const iv of intervals) {
        if (mergedIntervals.length === 0) {
          mergedIntervals.push({ start: iv.start, end: iv.end, isRelevant: iv.isRelevant });
        } else {
          const last = mergedIntervals[mergedIntervals.length - 1];
          if (iv.start <= last.end) {
            last.end = Math.max(last.end, iv.end);
            last.isRelevant = last.isRelevant || iv.isRelevant;
          } else {
            mergedIntervals.push({ start: iv.start, end: iv.end, isRelevant: iv.isRelevant });
          }
        }
      }
      mergedYears = mergedIntervals.reduce((sum, iv) => sum + (iv.end - iv.start + 1), 0);
      relevantYears = mergedIntervals.reduce((sum, iv) => sum + (iv.isRelevant ? (iv.end - iv.start + 1) : 0), 0);

      // Domain-specific experience receives higher weighting (up to 20 pts)
      const effectiveYears = relevantYears > 0 ? (relevantYears * 1.5 + (mergedYears - relevantYears) * 0.5) : (mergedYears * 0.5);
      const experiencePoints = Math.min(20, Number(((Math.min(effectiveYears, 20) / 20.0) * 20).toFixed(1)));
      const experienceDetails: string[] = [];
      if (trainer.workExperiences.length > 0) {
        trainer.workExperiences.forEach((we) => {
          experienceDetails.push(`${we.title} at ${we.organization} (${we.startYear} - ${we.endYear || 'Present'})`);
        });
        experienceDetails.push(`Net distinct operational service: ${mergedYears} years (normalized without overlap)`);
      } else {
        experienceDetails.push('No work experience entries recorded in the profile.');
      }

      // -----------------------------------------------------------------------
      // 4. Published Course History (15% weight) - platform-recorded course status
      // -----------------------------------------------------------------------
      const relevantCourses = trainer.createdCourses.filter((c) => c.status === 'PUBLISHED' && (() => {
        const titleMatch = isMatch(c.title);
        const subjMatch = c.subject?.name ? isMatch(c.subject.name) : false;
        return titleMatch || subjMatch || subjectLower.includes('general');
      }));

      const publishedCount = relevantCourses.length;
      // 3 courses = full 15 points
      const deliveryPoints = Math.min(15, Number((Math.min(publishedCount, 3) * 5).toFixed(1)));
      const deliveryDetails: string[] = [];
      if (publishedCount > 0) {
        relevantCourses.forEach((c) => {
          deliveryDetails.push(`Course: "${c.title}" [Status: ${c.status}, Level: ${c.level}]`);
        });
      } else {
        deliveryDetails.push(`No platform courses authored under subject "${subjectName}".`);
      }

      // -----------------------------------------------------------------------
      // 5. Learner Feedback (10% weight) - Strict sample size & zero baseline
      // -----------------------------------------------------------------------
      const feedbacks = trainer.trainerFeedbacks;
      const feedbackCount = feedbacks.length;
      let feedbackPoints = 0;
      let averageRating = 0;
      const feedbackDetails: string[] = [];

      if (feedbackCount > 0) {
        const sumRating = feedbacks.reduce((acc, curr) => acc + curr.rating, 0);
        averageRating = Number((sumRating / feedbackCount).toFixed(2));
        // Dampen with confidence factor based on sample size (min 5 reviews for full weight)
        const confidenceFactor = Math.min(1.0, feedbackCount / 5.0);
        feedbackPoints = Number(((averageRating / 5.0) * 10 * confidenceFactor).toFixed(1));
        feedbackDetails.push(`Average platform-recorded learner rating: ${averageRating} / 5.0 (sample size: ${feedbackCount})`);
        if (feedbackCount < 5) {
          feedbackDetails.push(`Confidence factor ${(confidenceFactor * 100).toFixed(0)}% applied due to limited evaluation sample.`);
        }
      } else {
        feedbackPoints = 0;
        feedbackDetails.push('No trainee feedback collected yet. Defaulting to 0 points (no synthetic rating substitution).');
      }

      // -----------------------------------------------------------------------
      // Final Aggregation & Explainability
      // -----------------------------------------------------------------------
      const totalScore = Number((skillPoints + credentialPoints + experiencePoints + deliveryPoints + feedbackPoints).toFixed(1));

      let platformRecordedCount = 0;
      let selfDeclaredCount = 0;
      let missingCount = 0;

      if (skillEvidenceType === 'SELF_DECLARED') selfDeclaredCount++; else missingCount++;
      if (credentialCount > 0) selfDeclaredCount++; else missingCount++;
      if (mergedYears > 0) selfDeclaredCount++; else missingCount++;
      if (publishedCount > 0) platformRecordedCount++; else missingCount++;
      if (feedbackCount > 0) platformRecordedCount++; else missingCount++;

      return {
        trainerId: trainer.id,
        name: trainer.name,
        email: trainer.email,
        isSample: trainer.email.endsWith('.demo.local'),
        department: trainer.department,
        designation: trainer.designation,
        matchScore: totalScore,
        evidenceSummary: {
          platformRecordedCount,
          selfDeclaredCount,
          missingCount,
        },
        breakdown: {
          relevantSkills: {
            weight: '30%',
            points: skillPoints,
            maxPoints: 30,
            evidenceType: skillEvidenceType,
            summary: matchingSkills.length > 0 ? `${matchingSkills.length} matching skills declared` : 'No matching skill',
            details: skillDetails,
          },
          relevantQualifications: {
            weight: '25%',
            points: credentialPoints,
            maxPoints: 25,
            evidenceType: credentialCount > 0 ? 'SELF_DECLARED' : 'MISSING',
            summary: `${credentialCount} relevant self-declared qualifications & certifications`,
            details: credentialDetails,
          },
          relevantExperience: {
            weight: '20%',
            points: experiencePoints,
            maxPoints: 20,
            evidenceType: mergedYears > 0 ? 'SELF_DECLARED' : 'MISSING',
            summary: `${mergedYears} years operational service`,
            details: experienceDetails,
          },
          publishedCourseHistory: {
            weight: '15%',
            points: deliveryPoints,
            maxPoints: 15,
            evidenceType: publishedCount > 0 ? 'PLATFORM_RECORDED' : 'MISSING',
            summary: `${publishedCount} courses delivered in domain`,
            details: deliveryDetails,
          },
          learnerFeedback: {
            weight: '10%',
            points: feedbackPoints,
            maxPoints: 10,
            evidenceType: feedbackCount > 0 ? 'PLATFORM_RECORDED' : 'MISSING',
            summary: feedbackCount > 0 ? `${averageRating}/5.0 (${feedbackCount} reviews)` : 'No feedback data',
            details: feedbackDetails,
          },
        },
      };
    });

    return recommendations.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Heatmap: Department x Skill proficiency averages
   */
  async getSkillHeatmap() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', department: { not: null } },
      include: {
        userSkills: { include: { skill: true } },
      },
    });

    const matrix: Record<string, Record<string, { total: number; count: number }>> = {};

    for (const user of users) {
      const dept = user.department || 'General';
      if (!matrix[dept]) matrix[dept] = {};

      for (const us of user.userSkills) {
        const skillName = us.skill.name;
        if (!matrix[dept][skillName]) {
          matrix[dept][skillName] = { total: 0, count: 0 };
        }
        matrix[dept][skillName].total += us.proficiency;
        matrix[dept][skillName].count += 1;
      }
    }

    const heatmap = Object.entries(matrix).map(([dept, skills]) => ({
      department: dept,
      skills: Object.entries(skills).map(([skill, stat]) => ({
        skill,
        averageProficiency: Number((stat.total / stat.count).toFixed(2)),
        sampleSize: stat.count,
      })),
    }));

    return heatmap;
  }
}
