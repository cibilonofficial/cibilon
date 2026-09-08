import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Briefcase,
  CarFront,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Home,
  Landmark,
  MoreHorizontal,
  Save,
  Send,
  ShieldPlus,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, DetailItem } from '@/components/ui/Card';
import { Checkbox, Input, RadioCards, Select, Textarea } from '@/components/ui/Field';
import { Dropzone, UploadRow, validateFile } from '@/components/ui/FileUpload';
import type { UploadedFile } from '@/components/ui/FileUpload';
import { ConfirmDialog } from '@/components/ui/Modal';
import { PageHeader, ProgressBar, SectionTitle } from '@/components/ui/Misc';
import { Chip } from '@/components/ui/StatusBadge';
import { Stepper } from '@/components/ui/Timeline';
import { useToast } from '@/components/ui/Toast';
import {
  DOCUMENT_CHECKLIST,
  INDIAN_STATES,
  LOAN_SERVICES,
  LOAN_PURPOSES,
  SERVICES,
} from '@/lib/constants';
import { getDocumentChecklist, isMandatoryDoc } from '@/data/documentationData';
import { cn, formatCurrency, maskId, uid } from '@/lib/utils';
import { payoutRangeFromRateCard } from '@/lib/finance';
import { usePayoutRateCard } from '@/hooks/usePayoutRateCard';
import {
  EMPTY_CUSTOMER,
  EMPTY_EMPLOYMENT,
  EMPTY_SERVICE_DETAILS,
  useData,
} from '@/store/DataContext';
import { useAuth } from '@/store/AuthContext';
import { CATEGORY_DESCRIPTIONS, CATEGORY_DOCUMENTS, SERVICE_CATEGORIES, categoryFor, validateCategoryFields, type ServiceCategory } from '../../../shared/service-categories';
import { CategoryFields, CategoryDetails } from '@/components/crm/CategoryFields';
import type {
  CustomerInfo,
  EmploymentInfo,
  ServiceDetails,
  ServiceType,
} from '@/types';

const STEPS = [
  'Customer',
  'Employment',
  'Service',
  'Details',
  'Documents',
  'Review',
];

const isLoanService = (service: ServiceType | '') => LOAN_SERVICES.includes(service as ServiceType);

const SERVICE_ICONS: Record<ServiceType, typeof Banknote> = {
  'Personal Loan': Banknote,
  'Business Loan': Briefcase,
  'Home Loan': Home,
  'Loan Against Property': Landmark,
  'Vehicle Loan': CarFront,
  'Credit Card': CreditCard,
  Insurance: ShieldPlus,
  'Other Financial Services': MoreHorizontal,
};

const SERVICE_BLURBS: Record<ServiceType, string> = {
  'Personal Loan': 'Unsecured, ₹50K–₹40L, 12–72 months',
  'Business Loan': 'Working capital & expansion, up to ₹75L',
  'Home Loan': 'Purchase, construction or balance transfer',
  'Loan Against Property': 'Secured against residential or commercial property',
  'Vehicle Loan': 'New and pre-owned, two & four wheeler',
  'Credit Card': 'Lifestyle, rewards and business cards',
  Insurance: 'Term, health and general insurance',
  'Other Financial Services': 'Anything not covered above',
};

type Errors = Record<string, string>;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_RE = /^[6-9]\d{9}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const PINCODE_RE = /^[1-9]\d{5}$/;

export function AddLead() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { submitApplication, saveDraft, applicationById, lenders } = useData();
  const { entries: payoutRateCard } = usePayoutRateCard();
  const lenderOptions = lenders.filter((lender) => lender.status === 'Active').map((lender) => lender.name);
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [step, setStep] = useState(0);
  const [customer, setCustomer] = useState<CustomerInfo>(EMPTY_CUSTOMER);
  const [employment, setEmployment] = useState<EmploymentInfo>(EMPTY_EMPLOYMENT);
  const [details, setDetails] = useState<ServiceDetails>(EMPTY_SERVICE_DETAILS);
  const [category, setCategory] = useState<ServiceCategory | ''>('');
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [declaration, setDeclaration] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  // Editing an existing draft/lead hydrates the form once.
  useEffect(() => {
    if (!editId) return;
    const existing = applicationById(editId);
    if (!existing) return;
    setCustomer(existing.customer);
    setEmployment(existing.employment);
    const existingCategory = categoryFor(existing.service, existing.serviceDetails.category);
    setDetails({ ...existing.serviceDetails, category: existingCategory, categoryFields: existing.serviceDetails.categoryFields ?? {} });
    setCategory(existingCategory);
  }, [editId, applicationById]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  const service = details.service as ServiceType | '';
  // Pull the document checklist from the Documentation Required page data
  const documentationChecklist = service
    ? getDocumentChecklist(
        service,
        employment.employmentType,
        employment.businessType,
        details.insuranceType,
      )
    : undefined;
  const checklist = (
    category && category in CATEGORY_DOCUMENTS
      ? CATEGORY_DOCUMENTS[category as keyof typeof CATEGORY_DOCUMENTS].map((doc) => ({
          name: doc.displayName,
          required: isMandatoryDoc(doc.displayName),
        }))
      : (documentationChecklist ?? (service ? DOCUMENT_CHECKLIST[service] : [])).map((doc) => ({
          name: doc.name,
          required: isMandatoryDoc(doc.name),
        }))
  );
  const requiredDocs = checklist.filter((c) => c.required);
  const uploadedNames = new Set(uploads.filter((u) => u.progress === 100).map((u) => u.name));
  const missingRequired = requiredDocs.filter((d) => !uploadedNames.has(d.name));

  const setCustomerField = <K extends keyof CustomerInfo>(key: K, value: CustomerInfo[K]) => {
    setCustomer((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const setEmploymentField = <K extends keyof EmploymentInfo>(key: K, value: EmploymentInfo[K]) => {
    setEmployment((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };
  const setDetailField = <K extends keyof ServiceDetails>(key: K, value: ServiceDetails[K]) => {
    setDetails((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validateStep = useCallback(
    (index: number): Errors => {
      const e: Errors = {};
      if (index === 0) {
        if (!customer.fullName.trim()) e.fullName = 'Full name is required.';
        if (!MOBILE_RE.test(customer.mobile.replace(/\D/g, '')))
          e.mobile = 'Enter a valid 10-digit Indian mobile number.';
        if (!EMAIL_RE.test(customer.email)) e.email = 'Enter a valid email address.';
        if (!customer.dob) e.dob = 'Date of birth is required.';
        if (!customer.gender) e.gender = 'Select a gender.';
        if (!PAN_RE.test(customer.pan.toUpperCase()))
          e.pan = 'PAN must look like ABCDE1234F.';
        if (customer.aadhaar.replace(/\D/g, '').length !== 12)
          e.aadhaar = 'Aadhaar must be 12 digits.';
        if (!customer.address.trim()) e.address = 'Address is required.';
        if (!customer.city.trim()) e.city = 'City is required.';
        if (!customer.state) e.state = 'Select a state.';
        if (!PINCODE_RE.test(customer.pincode)) e.pincode = 'Enter a valid 6-digit pincode.';
      }
      if (index === 1 && category === 'Loan') {
        if (!employment.employmentType) e.employmentType = 'Select an employment type.';
        if (!employment.monthlyIncome || Number(employment.monthlyIncome) <= 0)
          e.monthlyIncome = 'Enter the monthly income.';
        if (!employment.organisation.trim())
          e.organisation =
            employment.employmentType === 'Salaried'
              ? 'Company name is required.'
              : 'Business name is required.';
        if (!employment.experience) e.experience = 'Enter total work experience.';
        if (!employment.existingLoans) e.existingLoans = 'Tell us about existing loans.';
        if (!employment.bankName.trim()) e.bankName = 'Bank name is required.';
        if (!/^\d{9,18}$/.test(employment.accountNumber.replace(/\s/g, '')))
          e.accountNumber = 'Enter a valid account number.';
        if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(employment.ifsc.toUpperCase()))
          e.ifsc = 'IFSC must look like HDFC0000521.';
      }
      if (index === 2) {
        if (!details.service) e.service = 'Choose the service the customer needs.';
      }
      if (index === 3) {
        if (category) Object.assign(e, validateCategoryFields(category, details.categoryFields));
        if (isLoanService(details.service)) {
          if (!details.loanAmount || Number(details.loanAmount) <= 0)
            e.loanAmount = 'Enter the required loan amount.';
          if (!details.tenure) e.tenure = 'Select a preferred tenure.';
          if (!details.purpose) e.purpose = 'Select the purpose of the loan.';
        }
        if (details.service === 'Credit Card' && !details.cardCategory)
          e.cardCategory = 'Select a card category.';
        if (details.service === 'Insurance') {
          if (!details.insuranceType) e.insuranceType = 'Select the insurance type.';
          if (!details.sumAssured) e.sumAssured = 'Enter the sum assured.';
        }
        if (details.service === 'Other Financial Services' && !category && !details.serviceNotes.trim())
          e.serviceNotes = 'Describe the service the customer needs.';
      }
      if (index === 4) {
        if (missingRequired.length)
          e.documents = `${missingRequired.length} mandatory document(s) still pending.`;
      }
      if (index === 5) {
        if (!declaration) e.declaration = 'Please confirm the declaration before submitting.';
      }
      return e;
    },
    [customer, employment, details, category, missingRequired.length, declaration],
  );

  const goNext = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error('Some fields need attention', 'Fix the highlighted fields and try again.');
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const handleFiles = (files: File[], slot?: string) => {
    const accepted: UploadedFile[] = [];
    files.forEach((file, i) => {
      const problem = validateFile(file);
      if (problem) {
        toast.error('File rejected', problem);
        return;
      }
      // Files dropped on the general zone fill the next open checklist slot.
      const openSlot =
        slot ??
        checklist.find((c) => !uploadedNames.has(c.name) && !accepted.some((a) => a.name === c.name))
          ?.name ??
        `Other Document ${uploads.length + i + 1}`;

      accepted.push({
        id: uid('UP'),
        name: openSlot,
        fileName: file.name,
        fileType: file.type || 'application/octet-stream',
        size: file.size,
        progress: 100,
        status: 'Uploaded',
        required: checklist.find((c) => c.name === openSlot)?.required ?? false,
        file,
      });
    });

    if (!accepted.length) return;

    setUploads((prev) => [
      // A re-upload into the same slot replaces the previous file.
      ...prev.filter((p) => !accepted.some((a) => a.name === p.name)),
      ...accepted,
    ]);
    setErrors((prev) => ({ ...prev, documents: '' }));

  };

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const application = await submitApplication({
        customer: { ...customer, pan: customer.pan.toUpperCase() },
        employment: { ...employment, ifsc: employment.ifsc.toUpperCase() },
        serviceDetails: details,
        advisorId: user!.id,
        advisorName: user!.name,
        documents: uploads
          .filter((u) => u.progress === 100)
          .map((u) => ({
            name: u.name, fileName: u.fileName, fileType: u.fileType, size: u.size,
            uploadedAt: new Date().toISOString(), status: 'Under Verification' as const,
            remarks: '', required: u.required, file: u.file,
          })),
      });
      setConfirmOpen(false);
      setCreatedId(application.id);
      toast.success('Application submitted', `${application.id} is now with the verification desk.`);
    } catch (error) {
      toast.error('Submission failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const doSaveDraft = async () => {
    try {
      const id = await saveDraft({ customer, employment, serviceDetails: details });
      toast.success('Draft saved', `Draft ${id} is available in your Leads list.`);
    } catch (error) {
      toast.error('Could not save draft', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const estimatedPayout = payoutRangeFromRateCard(payoutRateCard, service, Number(details.loanAmount || 0));
  const estimatedPayoutText = estimatedPayout
    ? estimatedPayout.minimum === estimatedPayout.maximum
      ? formatCurrency(estimatedPayout.minimum)
      : `${formatCurrency(estimatedPayout.minimum)} – ${formatCurrency(estimatedPayout.maximum)}`
    : '';

  const resetForm = () => {
    setCategory('');
    setCustomer(EMPTY_CUSTOMER);
    setEmployment(EMPTY_EMPLOYMENT);
    setDetails(EMPTY_SERVICE_DETAILS);
    setUploads([]);
    setErrors({});
    setDeclaration(false);
    setCreatedId(null);
    setStep(0);
  };

  if (createdId) {
    return (
      <SuccessScreen
        applicationId={createdId}
        customerName={customer.fullName}
        onAddAnother={resetForm}
      />
    );
  }

  if (!category) return <>
    <PageHeader title="Add new lead" description="Choose the category to start the relevant application." />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{SERVICE_CATEGORIES.map((option, index) =>
      <button key={option} type="button" className="card-surface p-6 text-left hover:ring-2 hover:ring-brand-500 focus-visible:ring-2" onClick={() => {
        setCategory(option);
        setDetails({ ...EMPTY_SERVICE_DETAILS, category: option, categoryFields: {}, service: option === 'Loan' ? '' : option === 'Insurance' ? 'Insurance' : 'Other Financial Services' });
        setEmployment(EMPTY_EMPLOYMENT); setUploads([]); setErrors({}); setDeclaration(false); setStep(0);
      }}>
        <span className="text-sm text-brand-600">{index + 1}</span>
        <h2 className="mt-2 text-lg font-semibold">{option}</h2>
        <p className="mt-2 text-sm text-slate-500">{CATEGORY_DESCRIPTIONS[option]}</p>
      </button>)}</div>
  </>;

  return (
    <div ref={topRef}>
      <PageHeader
        title={editId ? `Edit lead ${editId}` : `Add new lead · ${category}`}
        description="Capture the customer, pick a service, attach the paperwork and submit it to the Cibilon processing desk."
        actions={
          <div className="flex gap-2"><Button variant="secondary" onClick={() => setCategory('')}>Change category</Button><Button
            variant="secondary"
            icon={<Save className="size-4" />}
            onClick={() => void doSaveDraft()}
          >
            Save as draft
          </Button></div>
        }
      />

      <Card className="mb-3">
        <div className="px-4 py-3 sm:px-5">
          <Stepper steps={STEPS} current={step} onSelect={(i) => i < step && setStep(i)} />
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5 sm:px-5">
          <ProgressBar
            value={step + 1}
            max={STEPS.length}
            tone="brand"
            label={
              <span>
                Step {step + 1} of {STEPS.length}
              </span>
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title={
            [
              'Customer information',
              'Employment & financial information',
              'Required service',
              'Service details',
              'Document upload',
              'Review & submit',
            ][step]
          }
          subtitle={
            [
              'KYC details exactly as they appear on the customer’s documents.',
              'Fields adapt to the customer’s employment profile.',
              'Pick the product the customer is applying for.',
              'What the customer is asking the lender for.',
              'Drag and drop the checklist below. Mandatory items are marked.',
              'Confirm everything reads correctly before it goes to processing.',
            ][step]
          }
          action={
            service ? (
              <Chip tone="brand">
                {(() => {
                  const Icon = SERVICE_ICONS[service];
                  return <Icon className="size-3.5" />;
                })()}
                {service}
              </Chip>
            ) : undefined
          }
        />

        <CardBody>
          {step === 0 && (
            <StepCustomer customer={customer} errors={errors} onChange={setCustomerField} />
          )}
          {step === 1 && (
            category === 'Loan' ? <StepEmployment
              employment={employment}
              errors={errors}
              onChange={setEmploymentField}
            /> : <p className="text-sm text-slate-600">Employment and bank details are not required for this enquiry. Continue to the category details; the processing desk can request supporting information if needed.</p>
          )}
          {step === 2 && (
            category === 'Loan' ? <StepService value={details.service} error={errors.service} onChange={(v) => { setDetails({ ...EMPTY_SERVICE_DETAILS, category: 'Loan', categoryFields: {}, service: v }); setUploads([]); setDeclaration(false); }} />
              : <div><SectionTitle>{category}</SectionTitle><p className="text-sm text-slate-600">{CATEGORY_DESCRIPTIONS[category]}</p></div>
          )}
          {step === 3 && (
            <><StepDetails details={details} errors={errors} lenderOptions={lenderOptions} onChange={setDetailField} />
              <div className="mt-5"><CategoryFields category={category} values={details.categoryFields ?? {}} errors={errors} onChange={(key, value) => { setDetailField('categoryFields', { ...details.categoryFields, [key]: value }); setErrors((prev) => ({ ...prev, [key]: '' })); }} /></div>
            </>
          )}
          {step === 4 && (
            <StepDocuments
              checklist={checklist}
              uploads={uploads}
              error={errors.documents}
              missingRequired={missingRequired.length}
              onFiles={handleFiles}
              onRemove={removeUpload}
            />
          )}
          {step === 5 && (
            <StepReview
              customer={customer}
              employment={employment}
              details={details}
              uploads={uploads}
              estimatedPayout={estimatedPayout}
              declaration={declaration}
              declarationError={errors.declaration}
              onDeclarationChange={setDeclaration}
              onJump={setStep}
            />
          )}
        </CardBody>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3.5 sm:px-5">
          <Button
            variant="secondary"
            icon={<ArrowLeft className="size-4" />}
            onClick={step === 0 ? () => navigate('/app/leads') : goBack}
          >
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>

          <div className="flex items-center gap-2">
            {step === 4 && missingRequired.length > 0 && (
              <span className="hidden text-xs text-amber-700 sm:block">
                {missingRequired.length} mandatory document(s) pending
              </span>
            )}
            {step < STEPS.length - 1 ? (
              <Button iconRight={<ArrowRight className="size-4" />} onClick={goNext}>
                Continue
              </Button>
            ) : (
              <Button
                icon={<Send className="size-4" />}
                onClick={() => {
                  const e = validateStep(5);
                  setErrors(e);
                  if (Object.keys(e).length) {
                    toast.error('Declaration required', 'Tick the declaration to submit.');
                    return;
                  }
                  setConfirmOpen(true);
                }}
              >
                Submit application
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Submit this application?"
        message={
          <>
            <span className="block">
              {customer.fullName}’s {service || 'application'} will be sent to the Cibilon processing
              desk. You will be able to track it, but customer details can only be edited if the desk
              sends the file back.
            </span>
            {estimatedPayout && (
              <span className="mt-3 block rounded-lg bg-money-50 px-3 py-2 text-[13px] text-money-700">
                Expected payout range on disbursal: {estimatedPayoutText}
              </span>
            )}
          </>
        }
        confirmLabel="Submit application"
        loading={submitting}
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Customer                                                   */
/* ------------------------------------------------------------------ */

function StepCustomer({
  customer,
  errors,
  onChange,
}: {
  customer: CustomerInfo;
  errors: Errors;
  onChange: <K extends keyof CustomerInfo>(key: K, value: CustomerInfo[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Identity</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="Full name"
            required
            placeholder="As printed on the PAN card"
            value={customer.fullName}
            error={errors.fullName}
            onChange={(e) => onChange('fullName', e.target.value)}
          />
          <Input
            label="Mobile number"
            required
            inputMode="numeric"
            maxLength={10}
            placeholder="9876543210"
            prefix="+91"
            value={customer.mobile}
            error={errors.mobile}
            onChange={(e) => onChange('mobile', e.target.value.replace(/\D/g, ''))}
          />
          <Input
            label="Email address"
            required
            type="email"
            placeholder="customer@email.com"
            value={customer.email}
            error={errors.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
          <Input
            label="Date of birth"
            required
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={customer.dob}
            error={errors.dob}
            onChange={(e) => onChange('dob', e.target.value)}
          />
          <Select
            label="Gender"
            required
            options={['Male', 'Female', 'Other']}
            value={customer.gender}
            error={errors.gender}
            onChange={(e) => onChange('gender', e.target.value as CustomerInfo['gender'])}
          />
        </div>
      </div>

      <div>
        <SectionTitle>KYC</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="PAN number"
            required
            maxLength={10}
            placeholder="ABCDE1234F"
            className="uppercase"
            value={customer.pan}
            error={errors.pan}
            hint="10 characters, as on the PAN card"
            onChange={(e) => onChange('pan', e.target.value.toUpperCase())}
          />
          <Input
            label="Aadhaar number"
            required
            inputMode="numeric"
            maxLength={14}
            placeholder="1234 5678 9012"
            value={customer.aadhaar}
            error={errors.aadhaar}
            hint="Stored masked; only the last 4 digits are shown"
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
              onChange('aadhaar', digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim());
            }}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Address</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Textarea
            label="Residential address"
            required
            rows={2}
            placeholder="Flat / building / street"
            containerClassName="sm:col-span-2 lg:col-span-3"
            value={customer.address}
            error={errors.address}
            onChange={(e) => onChange('address', e.target.value)}
          />
          <Input
            label="City"
            required
            placeholder="Mumbai"
            value={customer.city}
            error={errors.city}
            onChange={(e) => onChange('city', e.target.value)}
          />
          <Select
            label="State"
            required
            options={INDIAN_STATES}
            value={customer.state}
            error={errors.state}
            onChange={(e) => onChange('state', e.target.value)}
          />
          <Input
            label="Pincode"
            required
            inputMode="numeric"
            maxLength={6}
            placeholder="400001"
            value={customer.pincode}
            error={errors.pincode}
            onChange={(e) => onChange('pincode', e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Employment                                                 */
/* ------------------------------------------------------------------ */

function StepEmployment({
  employment,
  errors,
  onChange,
}: {
  employment: EmploymentInfo;
  errors: Errors;
  onChange: <K extends keyof EmploymentInfo>(key: K, value: EmploymentInfo[K]) => void;
}) {
  const type = employment.employmentType;
  const salaried = type === 'Salaried';
  const selfEmployed = type === 'Self Employed' || type === 'Business';

  return (
    <div className="space-y-6">
      <RadioCards
        label="Employment type"
        name="employmentType"
        value={type}
        error={errors.employmentType}
        onChange={(v) => onChange('employmentType', v as EmploymentInfo['employmentType'])}
        options={[
          { value: 'Salaried', label: 'Salaried', description: 'Draws a monthly salary' },
          {
            value: 'Self Employed',
            label: 'Self Employed',
            description: 'Professional or consultant',
          },
          { value: 'Business', label: 'Business', description: 'Owns a registered business' },
          { value: 'Other', label: 'Other', description: 'Pensioner, rental income, etc.' },
        ]}
      />

      {type && (
        <>
          <div>
            <SectionTitle>Income</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Monthly income"
                required
                inputMode="numeric"
                prefix="₹"
                placeholder="75000"
                value={employment.monthlyIncome}
                error={errors.monthlyIncome}
                onChange={(e) => onChange('monthlyIncome', e.target.value.replace(/\D/g, ''))}
              />
              <Input
                label={salaried ? 'Company name' : 'Business name'}
                required
                placeholder={salaried ? 'Tata Consultancy Services' : 'Mehta Traders'}
                value={employment.organisation}
                error={errors.organisation}
                onChange={(e) => onChange('organisation', e.target.value)}
              />
              <Input
                label={salaried ? 'Total work experience (years)' : 'Years in business'}
                required
                inputMode="numeric"
                placeholder="6"
                value={employment.experience}
                error={errors.experience}
                onChange={(e) => onChange('experience', e.target.value.replace(/\D/g, ''))}
              />

              {salaried && (
                <Input
                  label="Designation"
                  placeholder="Senior Manager"
                  value={employment.designation}
                  onChange={(e) => onChange('designation', e.target.value)}
                />
              )}

              {selfEmployed && (
                <>
                  <Select
                    label="Business constitution"
                    options={[
                      'Proprietorship',
                      'Partnership',
                      'LLP',
                      'Private Limited',
                      'Public Limited',
                    ]}
                    value={employment.businessType}
                    onChange={(e) => onChange('businessType', e.target.value)}
                  />
                  <Input
                    label="GSTIN"
                    placeholder="27AAKCM4571R1ZP"
                    className="uppercase"
                    value={employment.gstin}
                    onChange={(e) => onChange('gstin', e.target.value.toUpperCase())}
                  />
                  <Input
                    label="Nature of work"
                    placeholder="Trading & distribution"
                    value={employment.natureOfWork}
                    onChange={(e) => onChange('natureOfWork', e.target.value)}
                  />
                </>
              )}
            </div>
          </div>

          <div>
            <SectionTitle>Credit profile</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Select
                label="Existing loans"
                required
                options={['Yes', 'No']}
                placeholder="Select…"
                value={employment.existingLoans}
                error={errors.existingLoans}
                onChange={(e) =>
                  onChange('existingLoans', e.target.value as EmploymentInfo['existingLoans'])
                }
              />
              {employment.existingLoans === 'Yes' && (
                <Input
                  label="Total existing EMI"
                  inputMode="numeric"
                  prefix="₹"
                  placeholder="14500"
                  value={employment.existingEmi}
                  onChange={(e) => onChange('existingEmi', e.target.value.replace(/\D/g, ''))}
                />
              )}
              <Select
                label="Approximate credit score"
                options={[
                  'Below 600',
                  '600 – 650',
                  '650 – 700',
                  '700 – 750',
                  '750 – 800',
                  'Above 800',
                  'Not known',
                ]}
                hint="A bureau pull will confirm the exact score"
                value={employment.creditScore}
                onChange={(e) => onChange('creditScore', e.target.value)}
              />
            </div>
          </div>

          <div>
            <SectionTitle>Banking</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Bank name"
                required
                placeholder="HDFC Bank"
                value={employment.bankName}
                error={errors.bankName}
                onChange={(e) => onChange('bankName', e.target.value)}
              />
              <Input
                label="Account number"
                required
                inputMode="numeric"
                placeholder="50100294417832"
                value={employment.accountNumber}
                error={errors.accountNumber}
                onChange={(e) => onChange('accountNumber', e.target.value.replace(/\D/g, ''))}
              />
              <Input
                label="IFSC code"
                required
                maxLength={11}
                className="uppercase"
                placeholder="HDFC0000521"
                value={employment.ifsc}
                error={errors.ifsc}
                onChange={(e) => onChange('ifsc', e.target.value.toUpperCase())}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Service                                                    */
/* ------------------------------------------------------------------ */

function StepService({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: ServiceType) => void;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SERVICES.filter((option) => categoryFor(option) === 'Loan').map((option) => {
          const Icon = SERVICE_ICONS[option];
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              className={cn(
                'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-all',
                active
                  ? 'border-brand-600 bg-brand-50/70 ring-1 ring-brand-600'
                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50',
              )}
            >
              <span
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg',
                  active ? 'bg-brand-900 text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="text-sm font-semibold text-slate-900">{option}</span>
              <span className="text-xs leading-snug text-slate-500">{SERVICE_BLURBS[option]}</span>
              {active && (
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-brand-700">
                  <CheckCircle2 className="size-3.5" />
                  Selected
                </span>
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}

      {value && (() => {
        const previewDocs = getDocumentChecklist(value, 'Salaried') ?? DOCUMENT_CHECKLIST[value as ServiceType];
        return (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-[13px] font-semibold text-slate-800">
              Documents required for {value}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {previewDocs.map((doc) => (
                <li key={doc.name}>
                  <Chip tone={doc.required ? 'brand' : 'neutral'}>
                    {doc.name}
                    {doc.required && <span className="text-rose-500">*</span>}
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        );
      })()}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Service details                                            */
/* ------------------------------------------------------------------ */

function StepDetails({
  details,
  errors,
  lenderOptions,
  onChange,
}: {
  details: ServiceDetails;
  errors: Errors;
  lenderOptions: string[];
  onChange: <K extends keyof ServiceDetails>(key: K, value: ServiceDetails[K]) => void;
}) {
  const service = details.service as ServiceType;
  const loan = isLoanService(service);
  const amount = Number(details.loanAmount || 0);
  const tenure = Number(details.tenure || 0);
  // Indicative EMI at 11% p.a. reducing balance — purely for advisor guidance.
  const rate = 0.11 / 12;
  const emi =
    amount && tenure
      ? Math.round((amount * rate * (1 + rate) ** tenure) / ((1 + rate) ** tenure - 1))
      : 0;

  return (
    <div className="space-y-6">
      {loan && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Required loan amount"
              required
              inputMode="numeric"
              prefix="₹"
              placeholder="1000000"
              value={details.loanAmount}
              error={errors.loanAmount}
              hint={amount ? formatCurrency(amount) : undefined}
              onChange={(e) => onChange('loanAmount', e.target.value.replace(/\D/g, ''))}
            />
            <Select
              label="Preferred tenure"
              required
              options={[
                { label: '12 months', value: '12' },
                { label: '24 months', value: '24' },
                { label: '36 months', value: '36' },
                { label: '48 months', value: '48' },
                { label: '60 months', value: '60' },
                { label: '84 months', value: '84' },
                { label: '120 months', value: '120' },
                { label: '180 months', value: '180' },
                { label: '240 months', value: '240' },
                { label: '300 months', value: '300' },
              ]}
              value={details.tenure}
              error={errors.tenure}
              onChange={(e) => onChange('tenure', e.target.value)}
            />
            <Select
              label="Purpose of loan"
              required
              options={LOAN_PURPOSES}
              value={details.purpose}
              error={errors.purpose}
              onChange={(e) => onChange('purpose', e.target.value)}
            />
            <Select
              label="Preferred bank / NBFC"
              options={lenderOptions}
              hint="Optional — we will match the best fit if left blank"
              value={details.preferredLender}
              onChange={(e) => onChange('preferredLender', e.target.value)}
            />
          </div>

          {emi > 0 && (
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
              <div>
                <p className="text-xs text-slate-500">Indicative EMI @ 11% p.a.</p>
                <p className="tnum mt-0.5 text-lg font-semibold text-slate-900">
                  {formatCurrency(emi)}
                  <span className="text-xs font-normal text-slate-500"> / month</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Total repayment</p>
                <p className="tnum mt-0.5 text-lg font-semibold text-slate-900">
                  {formatCurrency(emi * tenure)}
                </p>
              </div>
              <p className="text-xs leading-snug text-slate-400 sm:ml-auto sm:max-w-xs">
                Indicative only. Final rate and EMI are decided by the lender at sanction.
              </p>
            </div>
          )}
        </>
      )}

      {service === 'Credit Card' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Card category"
            required
            options={[
              'Entry Level',
              'Cashback',
              'Travel & Miles',
              'Premium Rewards',
              'Super Premium',
              'Business Card',
              'Secured (FD backed)',
            ]}
            value={details.cardCategory}
            error={errors.cardCategory}
            onChange={(e) => onChange('cardCategory', e.target.value)}
          />
          <Input
            label="Existing credit cards"
            inputMode="numeric"
            placeholder="1"
            value={details.existingCards}
            onChange={(e) => onChange('existingCards', e.target.value.replace(/\D/g, ''))}
          />
          <Select
            label="Preferred issuer"
            options={lenderOptions}
            value={details.preferredLender}
            onChange={(e) => onChange('preferredLender', e.target.value)}
          />
        </div>
      )}

      {service === 'Insurance' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Insurance type"
            required
            options={[
              'Term Life Insurance',
              'Endowment / Savings Plan',
              'ULIP',
              'Health Insurance',
              'Motor Insurance',
              'Home Insurance',
            ]}
            value={details.insuranceType}
            error={errors.insuranceType}
            onChange={(e) => onChange('insuranceType', e.target.value)}
          />
          <Input
            label="Sum assured"
            required
            inputMode="numeric"
            prefix="₹"
            placeholder="10000000"
            value={details.sumAssured}
            error={errors.sumAssured}
            hint={details.sumAssured ? formatCurrency(Number(details.sumAssured)) : undefined}
            onChange={(e) => onChange('sumAssured', e.target.value.replace(/\D/g, ''))}
          />
          <Select
            label="Premium frequency"
            options={['Monthly', 'Quarterly', 'Half-yearly', 'Annual', 'Single premium']}
            value={details.premiumFrequency}
            onChange={(e) => onChange('premiumFrequency', e.target.value)}
          />
        </div>
      )}

      <Textarea
        label={
          service === 'Other Financial Services'
            ? 'Describe the service required'
            : 'Additional notes for the processing desk'
        }
        required={service === 'Other Financial Services' && !details.category}
        rows={3}
        placeholder="Anything the ops team should know — urgency, co-applicant, existing relationship with a lender…"
        value={details.serviceNotes}
        error={errors.serviceNotes}
        onChange={(e) => onChange('serviceNotes', e.target.value)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Documents                                                  */
/* ------------------------------------------------------------------ */

function StepDocuments({
  checklist,
  uploads,
  error,
  missingRequired,
  onFiles,
  onRemove,
}: {
  checklist: { name: string; required: boolean }[];
  uploads: UploadedFile[];
  error?: string;
  missingRequired: number;
  onFiles: (files: File[], slot?: string) => void;
  onRemove: (id: string) => void;
}) {
  const slotInput = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);
  const byName = new Map(uploads.map((u) => [u.name, u]));
  const extras = uploads.filter((u) => !checklist.some((c) => c.name === u.name));
  const done = checklist.filter((c) => byName.get(c.name)?.progress === 100).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="min-w-[12rem] flex-1">
          <ProgressBar
            value={done}
            max={Math.max(1, checklist.length)}
            tone={missingRequired === 0 ? 'money' : 'brand'}
            label={
              <span>
                {done} of {checklist.length} checklist items uploaded
              </span>
            }
          />
        </div>
        {missingRequired > 0 ? (
          <Chip tone="warn">{missingRequired} mandatory pending</Chip>
        ) : (
          <Chip tone="money">
            <FileCheck2 className="size-3.5" />
            All mandatory documents attached
          </Chip>
        )}
      </div>

      <Dropzone onFiles={(files) => onFiles(files)} />

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div>
        <SectionTitle>Checklist</SectionTitle>
        <div className="space-y-2">
          {checklist.map((item) => {
            const file = byName.get(item.name);
            if (file) {
              return (
                <UploadRow
                  key={item.name}
                  file={file}
                  onRemove={() => onRemove(file.id)}
                  onReplace={() => {
                    setActiveSlot(item.name);
                    slotInput.current?.click();
                  }}
                />
              );
            }
            return (
              <div
                key={item.name}
                className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white text-slate-300 ring-1 ring-slate-200">
                  <FileCheck2 className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-slate-700">
                    {item.name}
                    {item.required && (
                      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
                        Required
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">Not uploaded yet</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setActiveSlot(item.name);
                    slotInput.current?.click();
                  }}
                >
                  Upload
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {extras.length > 0 && (
        <div>
          <SectionTitle>Additional documents</SectionTitle>
          <div className="space-y-2">
            {extras.map((file) => (
              <UploadRow key={file.id} file={file} onRemove={() => onRemove(file.id)} />
            ))}
          </div>
        </div>
      )}

      <input
        ref={slotInput}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length && activeSlot) onFiles(files.slice(0, 1), activeSlot);
          setActiveSlot(null);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 — Review                                                     */
/* ------------------------------------------------------------------ */

function StepReview({
  customer,
  employment,
  details,
  uploads,
  estimatedPayout,
  declaration,
  declarationError,
  onDeclarationChange,
  onJump,
}: {
  customer: CustomerInfo;
  employment: EmploymentInfo;
  details: ServiceDetails;
  uploads: UploadedFile[];
  estimatedPayout: ReturnType<typeof payoutRangeFromRateCard>;
  declaration: boolean;
  declarationError?: string;
  onDeclarationChange: (value: boolean) => void;
  onJump: (step: number) => void;
}) {
  const loan = isLoanService(details.service);

  return (
    <div className="space-y-5">
      <ReviewSection title="Customer information" onEdit={() => onJump(0)}>
        <DetailItem label="Full name" value={customer.fullName} />
        <DetailItem label="Mobile" value={`+91 ${customer.mobile}`} mono />
        <DetailItem label="Email" value={customer.email} />
        <DetailItem label="Date of birth" value={customer.dob} />
        <DetailItem label="Gender" value={customer.gender} />
        <DetailItem label="PAN" value={maskId(customer.pan)} mono />
        <DetailItem label="Aadhaar" value={maskId(customer.aadhaar)} mono />
        <DetailItem
          label="Address"
          value={`${customer.address}, ${customer.city}, ${customer.state} ${customer.pincode}`}
          className="sm:col-span-2"
        />
      </ReviewSection>

      {categoryFor(details.service, details.category) === 'Loan' && <ReviewSection title="Employment & financials" onEdit={() => onJump(1)}>
        <DetailItem label="Employment type" value={employment.employmentType} />
        <DetailItem
          label="Monthly income"
          value={employment.monthlyIncome ? formatCurrency(Number(employment.monthlyIncome)) : ''}
        />
        <DetailItem label="Organisation" value={employment.organisation} />
        <DetailItem label="Experience" value={employment.experience ? `${employment.experience} years` : ''} />
        {employment.designation && <DetailItem label="Designation" value={employment.designation} />}
        {employment.businessType && (
          <DetailItem label="Constitution" value={employment.businessType} />
        )}
        {employment.gstin && <DetailItem label="GSTIN" value={employment.gstin} mono />}
        <DetailItem label="Existing loans" value={employment.existingLoans} />
        {employment.existingLoans === 'Yes' && (
          <DetailItem
            label="Existing EMI"
            value={employment.existingEmi ? formatCurrency(Number(employment.existingEmi)) : ''}
          />
        )}
        <DetailItem label="Credit score" value={employment.creditScore} />
        <DetailItem label="Bank" value={employment.bankName} />
        <DetailItem label="Account" value={maskId(employment.accountNumber)} mono />
        <DetailItem label="IFSC" value={employment.ifsc} mono />
      </ReviewSection>}

      <ReviewSection title="Service requested" onEdit={() => onJump(2)}>
        <DetailItem label="Category" value={categoryFor(details.service, details.category)} />
        <CategoryDetails category={categoryFor(details.service, details.category)} values={details.categoryFields} />
        <DetailItem label="Service" value={details.service} />
        {loan && (
          <>
            <DetailItem
              label="Loan amount"
              value={details.loanAmount ? formatCurrency(Number(details.loanAmount)) : ''}
            />
            <DetailItem label="Tenure" value={details.tenure ? `${details.tenure} months` : ''} />
            <DetailItem label="Purpose" value={details.purpose} />
          </>
        )}
        {details.service === 'Credit Card' && (
          <>
            <DetailItem label="Card category" value={details.cardCategory} />
            <DetailItem label="Existing cards" value={details.existingCards} />
          </>
        )}
        {details.service === 'Insurance' && (
          <>
            <DetailItem label="Insurance type" value={details.insuranceType} />
            <DetailItem
              label="Sum assured"
              value={details.sumAssured ? formatCurrency(Number(details.sumAssured)) : ''}
            />
            <DetailItem label="Premium frequency" value={details.premiumFrequency} />
          </>
        )}
        <DetailItem label="Preferred lender" value={details.preferredLender} />
        {details.serviceNotes && (
          <DetailItem label="Notes" value={details.serviceNotes} className="sm:col-span-2" />
        )}
      </ReviewSection>

      <ReviewSection title={`Documents (${uploads.length})`} onEdit={() => onJump(4)} plain>
        {uploads.length === 0 ? (
          <p className="text-sm text-slate-500">No documents attached.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {uploads.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2"
              >
                <CheckCircle2 className="size-4 shrink-0 text-money-600" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-slate-800">
                    {file.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">{file.fileName}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </ReviewSection>

      {estimatedPayout && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-money-500/20 bg-money-50 px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <Wallet className="size-4 text-money-700" />
            <p className="text-[13px] font-medium text-money-700">
              Expected payout range on disbursal
            </p>
          </div>
          <p className="tnum text-lg font-semibold text-money-700">
            {estimatedPayout.minimum === estimatedPayout.maximum
              ? formatCurrency(estimatedPayout.minimum)
              : `${formatCurrency(estimatedPayout.minimum)} – ${formatCurrency(estimatedPayout.maximum)}`}
          </p>
        </div>
      )}

      <div
        className={cn(
          'rounded-lg border p-4',
          declarationError ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-slate-50',
        )}
      >
        <Checkbox
          label={
            <span className="text-[13px] leading-relaxed text-slate-600">
              I confirm that the customer has consented to this application, that the details above
              are accurate, and that the uploaded documents are genuine copies provided by the
              customer.
            </span>
          }
          checked={declaration}
          onChange={(e) => onDeclarationChange(e.target.checked)}
          className="items-start"
        />
        {declarationError && <p className="mt-2 text-xs text-rose-600">{declarationError}</p>}
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
  plain = false,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  plain?: boolean;
}) {
  return (
    <section className="rounded-lg border border-slate-200">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-[13px] font-medium text-brand-700 hover:text-brand-900 hover:underline"
        >
          Edit
        </button>
      </header>
      <div className="p-4">
        {plain ? children : <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</dl>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Success                                                             */
/* ------------------------------------------------------------------ */

function SuccessScreen({
  applicationId,
  customerName,
  onAddAnother,
}: {
  applicationId: string;
  customerName: string;
  onAddAnother: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardBody className="text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-money-50">
            <CheckCircle2 className="size-6 text-money-600" />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-slate-900">Application submitted</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {customerName}’s file has been sent to the Cibilon processing desk. You will be notified
            as soon as the verification team picks it up.
          </p>

          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Application ID</p>
            <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {applicationId}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="secondary"
              icon={<UserRound className="size-4" />}
              onClick={onAddAnother}
            >
              Add another lead
            </Button>
            <Button
              iconRight={<ArrowRight className="size-4" />}
              onClick={() => navigate(`/app/applications/${applicationId}`)}
            >
              Track this application
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
