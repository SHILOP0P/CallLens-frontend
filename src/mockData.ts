import type {
  AnalysisInstruction,
  AnalysisResponse,
  CallResponse,
  CompanyResponse,
  DepartmentResponse,
  TranscriptionResponse,
  UserResponse
} from "./types";

export const demoUser: UserResponse = {
  id: "00000000-0000-7000-8000-000000000001",
  email: "demo@calllens.local",
  full_name: "Иван",
  full_surname: "Петров",
  nick_name: "ivan",
  role: "user",
  post: "Отдел продаж",
  created_at: "2026-06-12T12:00:00Z"
};

export const demoCompanies: CompanyResponse[] = [
  {
    id: "00000000-0000-7000-8000-000000000101",
    name: "ТехноСофт ООО",
    manager_user_uuid: demoUser.id,
    member_limit: 25,
    created_at: "2026-06-12T12:00:00Z"
  }
];

export const demoDepartments: DepartmentResponse[] = [
  {
    id: "00000000-0000-7000-8000-000000000201",
    company_uuid: demoCompanies[0].id,
    name: "Отдел продаж",
    created_at: "2026-06-12T12:15:00Z"
  },
  {
    id: "00000000-0000-7000-8000-000000000202",
    company_uuid: demoCompanies[0].id,
    name: "Поддержка",
    created_at: "2026-06-12T12:20:00Z"
  }
];

export const demoCalls: CallResponse[] = [
  {
    id: "00000000-0000-7000-8000-000000001001",
    title: "Обсуждение условий договора.mp3",
    status: "analyzed",
    original_filename: "contract-call.mp3",
    mime_type: "audio/mpeg",
    size_bytes: 18_420_000,
    duration_seconds: 1122,
    uploaded_by_user_uuid: demoUser.id,
    company_uuid: demoCompanies[0].id,
    department_uuid: demoDepartments[0].id,
    visibility_scope: "department",
    created_at: "2026-05-21T14:32:00Z"
  },
  {
    id: "00000000-0000-7000-8000-000000001002",
    title: "Презентация продукта для клиента.mp3",
    status: "transcribed",
    original_filename: "product-demo.wav",
    mime_type: "audio/wav",
    size_bytes: 9_730_000,
    duration_seconds: 1531,
    uploaded_by_user_uuid: demoUser.id,
    company_uuid: demoCompanies[0].id,
    department_uuid: demoDepartments[0].id,
    visibility_scope: "department",
    created_at: "2026-05-20T17:45:00Z"
  },
  {
    id: "00000000-0000-7000-8000-000000001003",
    title: "Входящий звонок от ООО «Альтаир».mp3",
    status: "processing",
    original_filename: "altair-call.m4a",
    mime_type: "audio/mp4",
    size_bytes: 7_160_000,
    duration_seconds: 555,
    uploaded_by_user_uuid: demoUser.id,
    company_uuid: null,
    department_uuid: null,
    visibility_scope: "personal",
    created_at: "2026-05-19T10:05:00Z"
  },
  {
    id: "00000000-0000-7000-8000-000000001004",
    title: "Консультация по тарифам.mp3",
    status: "failed",
    original_filename: "tariff-call.ogg",
    mime_type: "audio/ogg",
    size_bytes: 6_510_000,
    duration_seconds: 468,
    uploaded_by_user_uuid: demoUser.id,
    company_uuid: demoCompanies[0].id,
    department_uuid: demoDepartments[1].id,
    visibility_scope: "department",
    created_at: "2026-05-17T09:30:00Z"
  }
];

export const demoTranscriptions: Record<string, TranscriptionResponse> = {
  [demoCalls[0].id]: {
    id: "00000000-0000-7000-8000-000000002001",
    call_uuid: demoCalls[0].id,
    status: "transcribed",
    text:
      "Иван: Добрый день! Мы получили ваше коммерческое предложение и хотели бы обсудить несколько моментов.\nКлиент: Добрый день! Конечно, давайте обсудим. Что именно вас заинтересовало?\nИван: Нас интересуют условия поставки и возможность интеграции с нашей системой.\nКлиент: По поставке мы предлагаем срок 3-5 рабочих дней. Интеграция возможна через наш API.",
    language: "ru",
    provider: "mock",
    error_message: null,
    created_at: "2026-05-21T14:36:00Z",
    updated_at: "2026-05-21T14:36:00Z"
  },
  [demoCalls[1].id]: {
    id: "00000000-0000-7000-8000-000000002002",
    call_uuid: demoCalls[1].id,
    status: "transcribed",
    text:
      "Менеджер провел презентацию продукта, клиент уточнил сроки запуска и попросил прислать расчет по двум тарифам.",
    language: "ru",
    provider: "mock",
    error_message: null,
    created_at: "2026-05-20T18:02:00Z",
    updated_at: "2026-05-20T18:02:00Z"
  }
};

export const demoAnalyses: Record<string, AnalysisResponse> = {
  [demoCalls[0].id]: {
    id: "00000000-0000-7000-8000-000000003001",
    call_uuid: demoCalls[0].id,
    status: "done",
    provider: "mock",
    model: null,
    result_json: {
      summary: "Клиент обсуждает договор, сроки поставки, интеграцию и оплату.",
      score: "Хорошо",
      topics: ["договор", "интеграция", "оплата", "сроки"],
      next_step: "Отправить коммерческое предложение клиенту"
    },
    result_text: "Клиент заинтересован. Следующий шаг: отправить КП и уточнить условия оплаты.",
    error_message: null,
    created_at: "2026-05-21T14:38:00Z",
    updated_at: "2026-05-21T14:38:00Z"
  }
};

export const demoInstructions: AnalysisInstruction[] = [
  {
    id: "00000000-0000-7000-8000-000000004001",
    scope: "department",
    user_uuid: null,
    company_uuid: demoCompanies[0].id,
    department_uuid: demoDepartments[0].id,
    title: "Отдел продаж",
    original_filename: "sales-checklist.md",
    file_path: "instructions/sales-checklist.md",
    mime_type: "text/markdown; charset=utf-8",
    size_bytes: 2140,
    content_sha256: "demo",
    sort_order: 1,
    is_active: true,
    created_by_user_uuid: demoUser.id,
    created_at: "2026-06-12T12:00:00Z",
    updated_at: "2026-06-12T12:00:00Z"
  }
];
