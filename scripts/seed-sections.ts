import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PHASE = "complaint_details";

interface SectionDef {
  title: string;
  description: string | null;
  sortOrder: number;
  questionIds: string[];
}

const sections: SectionDef[] = [
  {
    title: "Classification",
    description: "Categorize the complaint",
    sortOrder: 0,
    questionIds: [
      "cmp4nxlrn000mkf9eghsam5z6", // Complaint Category
      "cmp4nxluu000nkf9ebefonncq", // Violation Type
    ],
  },
  {
    title: "Details",
    description: "Provide detailed information about the complaint",
    sortOrder: 1,
    questionIds: [
      "cmp4nxly2000okf9e7dgwb3y8", // Subject
      "cmp4nxm1d000pkf9ecwy8ezx4", // Description
      "cmp4nxm4k000qkf9e78vvsfqb", // Desired Outcome
    ],
  },
  {
    title: "Incident Information",
    description: "When and where the incident occurred",
    sortOrder: 2,
    questionIds: [
      "cmp4nxm7s000rkf9ejinoii3y", // Date of Incident
      "cmp4nxmb0000skf9ewroy45wx", // Location
    ],
  },
  {
    title: "Involvement",
    description: "Details about ongoing involvement and witnesses",
    sortOrder: 3,
    questionIds: [
      "cmp4nxme7000tkf9e2hq7jenf", // Is this ongoing?
      "cmp4nxmhe000ukf9ep40f15v4", // How Often?
    ],
  },
  {
    title: "Witnesses",
    description: null,
    sortOrder: 4,
    questionIds: [
      "cmp4nxmkl000vkf9eunwtn486", // Witnesses
    ],
  },
  {
    title: "Previous Reports",
    description: null,
    sortOrder: 5,
    questionIds: [
      "cmp4nxmns000wkf9ezesf4oqz", // Have you filed a previous report?
    ],
  },
  {
    title: "Evidence & Documentation",
    description: "Upload supporting files for the complaint",
    sortOrder: 6,
    questionIds: [
      "cmp4nxmr0000xkf9e2z8emyiq", // Evidence / Supporting Documents
    ],
  },
];

// Old section header question to delete
const OLD_SECTION_HEADER_ID = "cmp4nxlod000lkf9els0nkjmr";

async function main() {
  console.log("=== Seeding FormSection records ===\n");

  // 1. Delete old section header question
  console.log(`Deleting old section header question (${OLD_SECTION_HEADER_ID})...`);
  try {
    const deleted = await prisma.formQuestion.delete({
      where: { id: OLD_SECTION_HEADER_ID },
    });
    console.log(`  ✓ Deleted: "${deleted.label}" (${deleted.id})`);
  } catch (err: any) {
    if (err.code === "P2025") {
      console.log("  ⏭ Already deleted or not found — skipping.");
    } else {
      throw err;
    }
  }

  // 2. Clean up stale empty sections from previous seeds
  const staleIds = ["sec_core_details_001", "sec_timeline_ctx_002"];
  for (const id of staleIds) {
    try {
      await prisma.formSection.delete({ where: { id } });
      console.log(`Deleted stale empty section: ${id}`);
    } catch (err: any) {
      if (err.code === "P2025") {
        console.log(`Stale section ${id} not found — skipping.`);
      } else {
        throw err;
      }
    }
  }

  // 3. Create sections and assign questions
  for (const sec of sections) {
    // Idempotency: check if section already exists by title + phase
    const existing = await prisma.formSection.findFirst({
      where: { phase: PHASE, title: sec.title },
    });

    let sectionId: string;

    if (existing) {
      console.log(`Section "${sec.title}" already exists (${existing.id}) — updating...`);
      await prisma.formSection.update({
        where: { id: existing.id },
        data: {
          description: sec.description,
          sortOrder: sec.sortOrder,
          isActive: true,
        },
      });
      sectionId = existing.id;
    } else {
      const created = await prisma.formSection.create({
        data: {
          phase: PHASE,
          title: sec.title,
          description: sec.description,
          sortOrder: sec.sortOrder,
          isActive: true,
        },
      });
      sectionId = created.id;
      console.log(`Created section: "${sec.title}" (${sectionId})`);
    }

    // 4. Assign questions to this section with sortOrder
    for (let i = 0; i < sec.questionIds.length; i++) {
      const qId = sec.questionIds[i];
      try {
        await prisma.formQuestion.update({
          where: { id: qId },
          data: {
            sectionId: sectionId,
            sortOrder: i,
          },
        });
        console.log(`  ✓ Assigned question ${qId} → section "${sec.title}" (sortOrder: ${i})`);
      } catch (err: any) {
        if (err.code === "P2025") {
          console.log(`  ⚠ Question ${qId} not found — skipping.`);
        } else {
          throw err;
        }
      }
    }
  }

  console.log("\n=== Verifying results ===\n");

  // Verify: list all sections
  const allSections = await prisma.formSection.findMany({
    where: { phase: PHASE },
    orderBy: { sortOrder: "asc" },
    include: {
      questions: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, label: true, fieldType: true, sortOrder: true },
      },
    },
  });

  for (const s of allSections) {
    console.log(`[${s.sortOrder}] ${s.title}${s.description ? ` — ${s.description}` : ""} (${s.questions.length} questions)`);
    for (const q of s.questions) {
      console.log(`    → (${q.sortOrder}) ${q.label} [${q.fieldType}]`);
    }
  }

  // Verify: count unassigned questions in complaint_details
  const unassigned = await prisma.formQuestion.count({
    where: { phase: PHASE, sectionId: null, isActive: true },
  });
  console.log(`\nRemaining unassigned questions in '${PHASE}': ${unassigned}`);

  console.log("\n=== Done ===");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
