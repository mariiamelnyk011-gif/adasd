export type VacancyStatus = 'Активна' | 'Закрита';
export type VacancyPriority = 'Гаряча' | 'Звичайна' | 'Холодна' | 'Термінова';

export interface Vacancy {
  id: string;
  title: string;
  department: string;
  status: VacancyStatus;
  salary: string;
  createdAt: string; // Дата відкриття
  closeDate?: string; // Дата закриття (необов'язково)
  schedule: string; // Графік роботи
  requirements: string; // Вимоги
  duties: string; // Обов'язки
  isAlwaysOpen: boolean; // Постійно відкрита вакансія (на перспективу)
  priority?: VacancyPriority; // Терміновість / пріоритет закриття
  openPositions?: number; // Кількість відкритих посад / місць
}

export type CandidateStatus = 
  | 'Новий' 
  | 'Скринінг' 
  | 'Повідомлення' 
  | 'Співбесіда' 
  | 'Співбесіда з керівником'
  | 'Стажування' 
  | 'Працевлаштовано' 
  | 'Подумає' 
  | 'Резерв'
  | 'Відмова кандидата'
  | 'Відмова компанії'
  | 'Відхилено';

export interface Candidate {
  id: string;
  name: string; // ПІБ
  birthDate: string; // Дата народження
  contactDate: string; // Дата контакту
  callType: 'Холодний' | 'Гарячий'; // Холодний чи Гарячий дзвінок
  source: string; // work.ua, robota.ua, facebook, instagram, threads, працівник, внз, інше
  vacancyId: string;
  status: CandidateStatus;
  phone: string;
  comment: string; // Коментар
  rating: number; // Оцінка (1-5)
  appliedAt: string;
  cvLink?: string;
  cvFileName?: string;
  cvFileContent?: string; // base64 representation of file
  hasDocuments?: boolean; // Наявність документів
  rejectionReason?: string; // Причина відхилення
  referredBy?: string; // Працівник, який порекомендував кандидата (джерело: працівник)
  sourceDetails?: string; // Уточнення/коментар для джерела (що саме "інше" або деталі джерела)
}

export type InterviewStatus = 'Заплановано' | 'Зворотний зв\'язок' | 'Завершено' | 'Скасовано' | 'Не прийшов';

export type InterviewResult = 
  | 'Очікує рішення'
  | 'Зворотний зв\'язок'
  | 'Співбесіда не відбулася'
  | 'Співбесіда пройшла успішно'
  | 'Співбесіда з керівником'
  | 'Перейшов на стажування'
  | 'Відмова компанії'
  | 'Відмова кандидата'
  | 'Резерв'
  | 'Подумає'
  | 'Інше';

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  dateTime: string;
  interviewer: string;
  feedback: string; // Коментар про співбесіду / фідбек
  rating: number; // Оцінка (1-5)
  status: InterviewStatus; // Чи відбулася співбесіда
  result: InterviewResult; // Результат співбесіди (пройшов, стажування, відмова і тд)
  rejectionReason?: string; // Причина відмови
  // Співбесіда з керівником (2-й етап)
  managerName?: string; // ПІБ або посада керівника
  managerInterviewDate?: string; // Дата та час співбесіди з керівником
  managerFeedback?: string; // Відгук / коментар керівника
  // Зворотний зв'язок з кандидатом
  feedbackGiven?: boolean; // Чи надано відповідь кандидату
  feedbackGivenAt?: string; // Дата та час надання зворотного зв'язку
  feedbackChannel?: 'Телефон' | 'Viber' | 'Telegram' | 'WhatsApp' | 'SMS' | 'Email' | 'Інше';
  feedbackOutcome?: string; // Результат (напр. 'Запрошено на стажування', 'Повідомлено про відмову', 'Не відповів')
  feedbackComment?: string; // Коментар чи примітка про розмову
  feedbackAttempts?: number; // Кількість спроб зв'язку
  lastAttemptAt?: string; // Дата останньої спроби зв'язку
}

export type InternStatus = 'Триває' | 'Успішно завершено' | 'Не пройшов' | 'Відмовився';

export interface Intern {
  id: string;
  candidateId: string;
  candidateName: string;
  birthDate: string; // Дата народження
  phone: string; // Контактний номер телефону
  position: string; // Посада де проходить стажування
  department: string; // Підрозділ де проходить стажування
  startDate: string;
  endDate: string;
  mentor: string;
  project: string;
  progress: number; // 0-100
  status: InternStatus;
  rating: number; // Оцінка стажера (1-5)
  comment?: string; // Коментар / нотатка по стажеру
  hasDocuments?: boolean; // Наявність документів
  dismissalDate?: string; // Дата звільнення
  rejectionReason?: string; // Причина чому не пройшов стажування
}

export interface FiredEmployee {
  id: string;
  candidateId?: string;
  name: string;
  position: string;
  department: string;
  startDate: string;
  endDate: string;
  tenureMonths: number;
  reason: string;
  exitNotes: string;
  phone?: string;
  email?: string;
  hasDocumentsReturned?: boolean; // Обхідний лист / повернуто майно та перевірено документи
  transferCaseNotes?: string; // Передача справ, контактів, доступів та проектів
  fileLink?: string; // Назва або посилання на наказ/заяву про звільнення
}

export interface CalendarEvent {
  id: string;
  title: string;
  dateTime: string;
  description?: string;
  candidateId?: string;
  isNotificationSent?: boolean;
}

export interface HRSystemData {
  vacancies: Vacancy[];
  candidates: Candidate[];
  interviews: Interview[];
  interns: Intern[];
  firedEmployees: FiredEmployee[];
  positionsList?: string[];
  departmentsList?: string[];
  stagesList?: string[];
  sourcesList?: string[];
  interviewStatusesList?: string[];
  interviewResultsList?: string[];
  internStatusesList?: string[];
  firedReasonsList?: string[];
  calendarEvents?: CalendarEvent[];
}

