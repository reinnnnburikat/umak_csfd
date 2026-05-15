import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const fallbackFaqs = [
  {
    id: 'fallback-1',
    label: 'What is CSFD?',
    value: 'The Center for Student Formation and Discipline (CSFD) is the office responsible for promoting character formation, upholding academic integrity, and ensuring a safe and conducive learning environment for all University of Makati students.',
    sortOrder: 0,
  },
  {
    id: 'fallback-2',
    label: 'How do I file a complaint?',
    value: 'You can file a complaint through our online complaint form available on the Services page. Fill out all the required fields, provide supporting details, and submit. You will receive a tracking token via email to monitor your complaint status.',
    sortOrder: 1,
  },
  {
    id: 'fallback-3',
    label: 'How do I request a Good Moral Certificate?',
    value: 'Submit a request through our Services page by selecting the Good Moral Certificate (GMC) option. Fill in the required information and submit. You will receive a tracking token to monitor your request.',
    sortOrder: 2,
  },
  {
    id: 'fallback-4',
    label: 'What are the office hours?',
    value: 'Our office is open Monday to Friday, 8:00 AM to 5:00 PM, except on official university holidays.',
    sortOrder: 3,
  },
  {
    id: 'fallback-5',
    label: 'How can I track my request?',
    value: 'Use the Track page on this website. Enter your request or complaint number along with the tracking token that was sent to your email when you submitted your request.',
    sortOrder: 4,
  },
  {
    id: 'fallback-6',
    label: 'What is a Uniform Exemption Request?',
    value: 'A Uniform Exemption Request (UER) allows students to request permission to be exempted from wearing the prescribed university uniform for valid reasons, such as medical conditions or religious practices.',
    sortOrder: 5,
  },
  {
    id: 'fallback-7',
    label: 'How long does GMC processing take?',
    value: 'Good Moral Certificate (GMC) processing typically takes 3-5 working days, depending on the volume of requests and verification requirements.',
    sortOrder: 6,
  },
  {
    id: 'fallback-8',
    label: 'What happens after filing a complaint?',
    value: 'After filing a complaint, it will be reviewed by CSFD staff. The case status will progress from Pending to Under Review, and eventually to Resolved, Dismissed, or Reopened. You can track the progress using your complaint number and tracking token.',
    sortOrder: 7,
  },
  {
    id: 'fallback-9',
    label: 'Can I file a complaint anonymously?',
    value: 'No, anonymous complaints are not accepted. However, your personal information is kept strictly confidential and is only accessible to authorized CSFD personnel involved in handling the case.',
    sortOrder: 8,
  },
  {
    id: 'fallback-10',
    label: 'What is a Cross-Dressing Clearance?',
    value: 'A Cross-Dressing Clearance (CDC) is a document issued by CSFD for students who need clearance related to cross-dressing policies of the university. This can be requested through our Services page.',
    sortOrder: 9,
  },
];

export async function GET() {
  try {
    const faqs = await db.managedList.findMany({
      where: {
        listType: 'faq',
        isActive: true,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        label: true,
        value: true,
        sortOrder: true,
      },
    });

    if (faqs.length === 0) {
      const fallbackResponse = NextResponse.json(fallbackFaqs);
      fallbackResponse.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
      return fallbackResponse;
    }

    const response = NextResponse.json(faqs);
    response.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return response;
  } catch (error) {
    console.error('Failed to fetch FAQs:', error);
    const fallbackResponse = NextResponse.json(fallbackFaqs);
    fallbackResponse.headers.set('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    return fallbackResponse;
  }
}
