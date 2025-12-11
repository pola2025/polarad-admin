// @ts-nocheck
// React 19와 @react-pdf/renderer의 React 18 타입 간 호환성 문제로 타입 체크 비활성화
import React, { ReactElement } from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
  DocumentProps,
} from '@react-pdf/renderer';

// 한글 폰트 등록 (Noto Sans KR)
Font.register({
  family: 'NotoSansKR',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@4.5.0/files/noto-sans-kr-all-400-normal.woff',
      fontWeight: 'normal',
    },
    {
      src: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-kr@4.5.0/files/noto-sans-kr-all-700-normal.woff',
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontFamily: 'NotoSansKR',
    fontSize: 10,
  },
  header: {
    textAlign: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    backgroundColor: '#f3f4f6',
    padding: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
  },
  label: {
    width: '30%',
    fontWeight: 'bold',
    color: '#374151',
  },
  value: {
    width: '70%',
    color: '#111827',
  },
  article: {
    marginBottom: 15,
  },
  articleTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  },
  articleContent: {
    lineHeight: 1.6,
    color: '#374151',
  },
  signatureSection: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 2,
    borderTopColor: '#111827',
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  signatureBox: {
    width: '45%',
  },
  signatureLabel: {
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#374151',
  },
  signatureImage: {
    width: 150,
    height: 75,
    marginTop: 5,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
  companyInfo: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },
  companyName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  companyDetail: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 2,
  },
});

interface ContractPDFProps {
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
  startDate: string;
  endDate: string;
  signedAt: string;
  clientSignature?: string;
  isPromotion?: boolean;
}

export function ContractPDF({
  contractNumber,
  companyName,
  ceoName,
  businessNumber,
  address,
  contactName,
  contactPhone,
  contactEmail,
  packageDisplayName,
  monthlyFee,
  contractPeriod,
  totalAmount,
  startDate,
  endDate,
  signedAt,
  clientSignature,
  isPromotion,
}: ContractPDFProps) {
  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ko-KR') + '원';
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>온라인 서비스 계약서</Text>
          <Text style={styles.subtitle}>계약번호: {contractNumber}</Text>
        </View>

        {/* 계약 당사자 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제1조 계약 당사자</Text>

          <View style={styles.row}>
            <Text style={styles.label}>갑 (서비스 이용자)</Text>
            <Text style={styles.value}>{companyName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>을 (서비스 제공자)</Text>
            <Text style={styles.value}>주식회사 폴라애드</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>대표자</Text>
            <Text style={styles.value}>{ceoName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>사업자등록번호</Text>
            <Text style={styles.value}>{businessNumber}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>사업장 주소</Text>
            <Text style={styles.value}>{address}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>담당자</Text>
            <Text style={styles.value}>{contactName} ({contactPhone})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>이메일</Text>
            <Text style={styles.value}>{contactEmail}</Text>
          </View>
        </View>

        {/* 계약 내용 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제2조 계약 내용</Text>

          <View style={styles.row}>
            <Text style={styles.label}>서비스 패키지</Text>
            <Text style={styles.value}>{packageDisplayName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>계약 기간</Text>
            <Text style={styles.value}>{contractPeriod}개월 ({startDate} ~ {endDate})</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>월 서비스 비용</Text>
            <Text style={styles.value}>{formatCurrency(monthlyFee)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>총 계약 금액</Text>
            <Text style={styles.value}>{formatCurrency(totalAmount)} (부가세 별도)</Text>
          </View>
        </View>

        {/* 계약 조항 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제3조 서비스 내용 및 범위</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 을은 갑에게 선택한 패키지에 포함된 약정된 서비스 제작 및 광고관리지원을 제공한다.{'\n'}
              2. 서비스의 구체적인 내용은 별첨 서비스 명세서에 따른다.{'\n'}
              3. 광고 집행에 필요한 광고비는 갑이 직접 결제하며, 을은 광고 설정 및 리포트 등 제반 서비스를 제공한다.{'\n'}
              4. 주요 광고 서비스는 Meta(Facebook, Instagram) 플랫폼을 중심으로 제공하며, 기타 플랫폼은 상호 협의 하에 제공 여부를 결정한다.{'\n'}
              5. 광고 소재(광고문구, 영상, 이미지 등)의 제작은 본 서비스에 포함되지 않으며, 갑이 직접 제작하여 을에게 제공해야 한다.{'\n'}
              6. 갑이 광고 소재를 제공하지 않을 경우 광고 집행이 불가하며, 이로 인한 지연에 대해 을은 책임지지 않는다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제4조 비용 및 결제</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 갑은 계약 체결 시 총 계약 금액을 선금으로 결제해야 하며, 결제 완료 후 서비스가 착수된다.{'\n'}
              2. 결제가 완료되지 않은 경우 서비스 제공이 개시되지 않는다.{'\n'}
              3. 세금계산서는 결제 완료 후 익월 10일 이내에 발행된다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제5조 계약의 해지</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 갑이 계약 기간 중 해지를 원할 경우, 최소 30일 전에 서면으로 통보해야 한다.{'\n'}
              2. 중도 해지 시 위약금이 발생할 수 있다.{'\n'}
              3. 을의 귀책사유로 서비스가 중단될 경우, 해당 기간만큼 서비스 기간을 연장한다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제6조 제작 진행 및 협조 의무</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 갑은 계약 체결 후 제작에 필요한 자료(로고, 이미지, 텍스트 등)를 30일 이내에 을에게 제공해야 한다.{'\n'}
              2. 갑이 자료를 30일 이내에 제공하지 않을 경우, 을은 별도 통보 없이 계약을 해지할 수 있으며, 이 경우 기납입된 금액은 반환하지 않는다.{'\n'}
              3. 시안에 대한 피드백은 시안 전달일로부터 3영업일 이내에 제공해야 한다. 기한 내 피드백이 없을 경우 시안이 승인된 것으로 간주한다.{'\n'}
              4. 기본 수정 횟수는 3회로 제한되며, 초과 수정 시 회당 50,000원의 추가 비용이 발생한다.{'\n'}
              5. 수정 범위는 기존 시안의 부분 수정에 한하며, 전면 재시작 수준의 수정은 별도 견적이 필요하다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제7조 환불 규정</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 모든 제작물 제작 전 해지 시: 납입 금액의 100% 환불{'\n'}
              2. 디자인(인쇄물) 제작 완료 후 해지 시: 납입 금액의 40% 환불{'\n'}
              3. 홈페이지 및 디자인 모두 제작 완료 후 해지 시: 납입 금액의 20% 환불{'\n'}
                 ※ 인쇄물 제작 완료 후, 홈페이지 제작 중 해지 시 홈페이지 제작은 중단됩니다.{'\n'}
              4. 모든 제작물 완료 후 해지 시: 환불 불가 (서비스 용역이 모두 제공된 것으로 간주){'\n'}
              5. 환불 시 제작된 홈페이지는 즉시 사용이 중단된다.{'\n'}
              6. 환불 시 광고지원 서비스는 모두 중단된다.{'\n'}
              7. 갑의 자료 미제공, 연락 두절 등 갑의 귀책사유로 인한 진행 불가 시: 환불 불가{'\n'}
              8. 환불 신청은 서면(이메일 포함)으로만 접수되며, 환불은 신청일로부터 7영업일 이내에 처리된다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제8조 면책 및 책임의 제한</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 갑이 제공한 자료(이미지, 텍스트, 상표 등)로 인해 발생하는 저작권, 초상권, 상표권 등 제3자와의 분쟁에 대해 을은 책임을 지지 않으며, 갑이 전적으로 책임진다.{'\n'}
              2. 을이 직접 제작하거나 제공한 자료(이미지, 폰트, 템플릿 등)로 인해 발생하는 저작권 등 제3자와의 분쟁에 대해서는 을이 책임진다.{'\n'}
              3. 갑의 요청에 따라 제작된 콘텐츠가 관계 법령에 위반될 경우, 그에 따른 법적 책임은 갑에게 있다.{'\n'}
              4. 천재지변, 시스템 장애, 외부 플랫폼(Google, Meta 등)의 정책 변경 등 을이 통제할 수 없는 사유로 인한 서비스 중단 또는 손해에 대해 을은 책임을 지지 않는다.{'\n'}
              5. 광고 성과는 시장 상황, 경쟁 환경, 상품 특성 등에 따라 달라질 수 있으며, 을은 특정 성과를 보장하지 않는다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제9조 유지 비용 및 추가 비용</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 웹사이트 제작 서비스를 이용하는 경우, 계약 기간 종료 후 2년차부터 연간 유지비용이 발생한다.{'\n'}
              2. 연간 유지비용: 도메인 및 호스팅 포함 500,000원/년 (부가세 별도){'\n'}
              3. 호스팅 트래픽이 월 100GB를 초과하는 경우, 초과 트래픽에 대해 별도 비용이 청구될 수 있다.{'\n'}
              4. Meta 광고 연동 서비스(광고 자동화, 알림, 대시보드 등)는 {isPromotion ? '계약일로부터 2년간' : '계약일로부터 1년간'} 무료로 제공된다.{'\n'}
              {isPromotion ? '' : '5. Meta 광고 연동 서비스 무료 기간 종료 후 계속 이용 시 월 220,000원 (3개월 단위 결제, 부가세 별도)이 청구된다.\n'}
              {isPromotion ? '5' : '6'}. 유지비용 미납 시 서비스가 중단될 수 있으며, 중단 후 30일 경과 시 데이터가 삭제될 수 있다.{'\n'}
              {isPromotion ? '6' : '7'}. 갑은 계약 종료 전 데이터 백업을 요청할 수 있으며, 을은 합리적인 범위 내에서 협조한다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제10조 지식재산권</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 을이 제작한 결과물의 저작권은 최종 대금 완납 시 갑에게 양도된다.{'\n'}
              2. 대금 완납 전까지 결과물의 저작권은 을에게 귀속된다.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제11조 분쟁 해결</Text>
          <View style={styles.article}>
            <Text style={styles.articleContent}>
              1. 본 계약과 관련하여 분쟁이 발생할 경우, 양 당사자는 상호 협의하여 원만히 해결하도록 노력한다.{'\n'}
              2. 협의가 이루어지지 않을 경우, 을의 주소지 관할 법원을 전속관할로 한다.
            </Text>
          </View>
        </View>

        {/* 서명 섹션 */}
        <View style={styles.signatureSection}>
          <Text style={{ textAlign: 'center', marginBottom: 20 }}>
            위 내용에 동의하며 계약을 체결합니다.
          </Text>
          <Text style={{ textAlign: 'center', marginBottom: 20 }}>
            계약 체결일: {signedAt}
          </Text>

          <View style={styles.signatureRow}>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>갑 ({companyName})</Text>
              {clientSignature ? (
                <Image style={styles.signatureImage} src={clientSignature} />
              ) : (
                <Text>{ceoName} (인)</Text>
              )}
            </View>
            <View style={styles.signatureBox}>
              <Text style={styles.signatureLabel}>을 (주식회사 폴라애드)</Text>
              <Text>대표이사 (인)</Text>
            </View>
          </View>
        </View>

        {/* 회사 정보 */}
        <View style={styles.companyInfo}>
          <Text style={styles.companyName}>주식회사 폴라애드</Text>
          <Text style={styles.companyDetail}>사업자등록번호: 000-00-00000</Text>
          <Text style={styles.companyDetail}>주소: 서울특별시 강남구 테헤란로 123</Text>
          <Text style={styles.companyDetail}>대표전화: 02-1234-5678 | 이메일: contact@polarad.co.kr</Text>
        </View>

        {/* 푸터 */}
        <Text style={styles.footer}>
          본 계약서는 전자서명법에 따라 유효한 전자문서입니다.
        </Text>
      </Page>
    </Document>
  );
}

// 서버사이드에서 사용할 팩토리 함수
export function createContractDocument(props: ContractPDFProps): ReactElement<DocumentProps> {
  return <ContractPDF {...props} /> as ReactElement<DocumentProps>;
}
