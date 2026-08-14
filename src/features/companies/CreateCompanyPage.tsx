import { ArrowLeft, Building2 } from "lucide-react";
import type { CompanyResponse } from "../../types";
import { CreateCompanyForm } from "./CompaniesPage";

export function CreateCompanyPage({ onBack, onCreated }: { onBack: () => void; onCreated: (company: CompanyResponse) => void | Promise<void> }) {
  return <section className="company-create-page atmospheric-page"><button className="text-button" type="button" onClick={onBack}><ArrowLeft size={16}/>К компаниям</button><div className="company-create-card glass"><span className="company-create-icon"><Building2 size={28}/></span><div><span className="eyebrow">НОВОЕ ПРОСТРАНСТВО</span><h1>Создать компанию</h1><p>Вы станете менеджером компании и сможете создавать отделы, приглашать сотрудников и назначать действия.</p></div><CreateCompanyForm onCreated={onCreated}/></div></section>;
}
