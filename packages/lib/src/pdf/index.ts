import { renderToBuffer } from '@react-pdf/renderer';
import { createContractDocument } from './contract-template';

export { ContractPDF, createContractDocument } from './contract-template';

interface ContractData {
  contractNumber: string;
  companyName: string;
  ceoName: string;
  businessNumber: string;
  address: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  packageName: string;
  packageDisplayName: string;
  monthlyFee: number;
  contractPeriod: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  signedAt: Date;
  clientSignature?: string;
  isPromotion?: boolean;
}

export async function generateContractPDF(data: ContractData): Promise<Buffer> {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  const pdfDocument = createContractDocument({
    contractNumber: data.contractNumber,
    companyName: data.companyName,
    ceoName: data.ceoName,
    businessNumber: data.businessNumber,
    address: data.address,
    contactName: data.contactName,
    contactPhone: data.contactPhone,
    contactEmail: data.contactEmail,
    packageName: data.packageName,
    packageDisplayName: data.packageDisplayName,
    monthlyFee: data.monthlyFee,
    contractPeriod: data.contractPeriod,
    totalAmount: data.totalAmount,
    startDate: formatDate(data.startDate),
    endDate: formatDate(data.endDate),
    signedAt: formatDate(data.signedAt),
    clientSignature: data.clientSignature,
    isPromotion: data.isPromotion,
  });

  const buffer = await renderToBuffer(pdfDocument);
  return Buffer.from(buffer);
}
