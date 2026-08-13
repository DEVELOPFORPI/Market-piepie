import type { AppLanguage } from '@/utils/languageStorage';

export type LegalKind = 'terms' | 'privacy';

export type LegalSection = { heading: string; body: string[] };

export type LegalDoc = {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
};

const UPDATED = '2026-08-13';

const TERMS_EN: LegalDoc = {
  title: 'Terms of Service',
  updated: UPDATED,
  intro:
    'These Terms govern your use of Market PiePie, a peer-to-peer marketplace that uses the Pi Network. By creating an account, paying the one-time join fee, or using the service, you agree to these Terms and the Privacy Policy. This is the service policy. It is not a substitute for advice from a lawyer in your country.',
  sections: [
    {
      heading: '1. The service',
      body: [
        'Market PiePie is an online marketplace where users list goods, chat, make offers, arrange meetups or shipping, leave reviews, and open disputes.',
        'The operator of Market PiePie provides the platform only. We are not the buyer or the seller, and we are not a party to trades between users. We do not take possession of listed items and we do not guarantee that a trade will complete.',
      ],
    },
    {
      heading: '2. Who may use it',
      body: [
        'You need a Pi Network account and must follow Pi Network rules as well as these Terms.',
        'You must be old enough to use Pi Network and to form a binding agreement where you live. If you use the service for a business, you confirm you are allowed to bind that business.',
      ],
    },
    {
      heading: '3. Account and one-time join fee',
      body: [
        'A one-time join fee in Pi is required to create a member account. The amount shown in the app at the time you pay is the amount due.',
        'The fee is processed by Pi Network. After your account is created, the fee is not refunded. If payment fails, no account is created and you may try again.',
        'If payment completed but a profile was not created, you can sign in again. We will restore the account from the completed payment and will not charge the join fee a second time.',
        'You are responsible for activity on your account. Do not share your Pi login or try to impersonate another person.',
      ],
    },
    {
      heading: '4. Listings, chat, and trades',
      body: [
        'You are responsible for your listings, photos, prices, chat messages, offers, meetup or shipping details, and reviews.',
        'Do not list or trade anything that is illegal where you or the other party live, stolen, counterfeit, dangerous, or that infringes someone else’s rights. Do not scam, harass, spam, or manipulate reviews, views, or ratings.',
        'Meetup and shipping are arranged between users. Check the item and the other party before you complete a trade. We do not provide escrow for goods and we do not deliver items.',
      ],
    },
    {
      heading: '5. Disputes between users',
      body: [
        'If a trade goes wrong, use the in-app dispute tools and try to resolve it with the other user first.',
        'We may review reports and disputes and may hide a listing, warn a user, or suspend an account. We are not a court and we do not have to pay either party or decide every dispute.',
      ],
    },
    {
      heading: '6. Content you post',
      body: [
        'You keep your rights in content you post. You give us a non-exclusive license to host, display, and store that content as needed to run the service (for example, showing a listing to other users).',
        'We may remove content that breaks these Terms or the law, or that we reasonably believe is harmful to other users.',
      ],
    },
    {
      heading: '7. Suspension and closing an account',
      body: [
        'We may suspend or close an account that breaks these Terms, is used for fraud, or creates a safety or legal risk.',
        'You may stop using the service. Closing an account does not cancel a completed join-fee payment or erase records we must keep (for example, payment records needed to prevent a second charge).',
      ],
    },
    {
      heading: '8. Pi Network and third parties',
      body: [
        'Pi authentication and Pi payments are provided by Pi Network. Wallet, payment status, and Pi account issues are subject to Pi Network’s own terms. We cannot reverse a Pi payment on our own.',
        'Images may be stored with our hosting or storage providers. Those providers process data only to run the service.',
      ],
    },
    {
      heading: '9. No warranty and limits on liability',
      body: [
        'The service is provided as is. We do not promise uninterrupted access, error-free listings, or that any user is trustworthy.',
        'To the fullest extent allowed by law, we are not liable for losses from trades between users, items that are not as described, meetup or shipping problems, Pi Network outages, or data you choose to share in chat.',
        'Nothing in these Terms limits liability that cannot be limited by law, including liability for fraud or for death or personal injury caused by negligence where that limit is not allowed.',
      ],
    },
    {
      heading: '10. Changes',
      body: [
        'We may update these Terms. The updated date will change at the top of this page. If you keep using the service after a change, you accept the new Terms. If you do not agree, stop using the service.',
      ],
    },
    {
      heading: '11. Contact',
      body: [
        'For questions about these Terms, use Inquiry in the app. We do not publish the operator’s home address, personal phone number, or other private contact details here.',
      ],
    },
  ],
};

const PRIVACY_EN: LegalDoc = {
  title: 'Privacy Policy',
  updated: UPDATED,
  intro:
    'This Policy explains what information Market PiePie collects, why we use it, and what choices you have. It applies when you browse as a guest, join, or use the marketplace. The operator of Market PiePie decides how this information is used. Contact us through Inquiry in the app.',
  sections: [
    {
      heading: '1. Information we collect',
      body: [
        'Pi account data you allow: Pi user id, Pi username, and, when you grant it, wallet address. We use this to sign you in, record the join-fee payment, and prevent a second charge.',
        'Profile data you enter: nickname, bio, region, and profile photo.',
        'Marketplace data: listings, photos, offers, orders, meetup or shipping details you submit, chat messages, reviews, reports, disputes, and inquiries.',
        'Payment records: payment id, amount, status, transaction id, wallet address, and related timestamps. We keep these even if a profile is later missing, so we can restore your account without charging again.',
        'Technical data: device or session identifiers, IP address, and basic browser information. We use these to keep you signed in, limit abuse (for example, view-count inflation), and protect the service.',
        'We do not ask for your government ID or home address as a condition of joining. If you put personal details in a listing or chat, other users can see them.',
      ],
    },
    {
      heading: '2. How we use it',
      body: [
        'To create and restore your account, process the join fee, and show your profile.',
        'To operate listings, chat, trades, reviews, notices, and disputes.',
        'To prevent fraud, spam, fake views, and unauthorized access to other people’s data.',
        'To respond to inquiries and to meet legal requests we are required to follow.',
      ],
    },
    {
      heading: '3. Who we share it with',
      body: [
        'Other users see what you choose to make public: nickname, listings, reviews, and messages you send them. They do not get your Pi user id from our public screens as a matter of course.',
        'Pi Network receives what is needed for login and payment.',
        'Hosting, database, and image-storage providers process data for us to run the service. They are not allowed to use it for their own marketing.',
        'We may share information if the law requires it, or to protect users from fraud or serious harm.',
        'We do not sell your personal information.',
      ],
    },
    {
      heading: '4. How long we keep it',
      body: [
        'Account and listing data are kept while your account is open and for a reasonable period after, so trades and disputes can still be reviewed.',
        'Completed join-fee payment records are kept so we do not charge you twice and so we can show a payment history to administrators.',
        'Chat, orders, and disputes are kept as needed to operate the service and handle reports.',
        'You may ask us through Inquiry to correct or delete data we do not need to keep. We may refuse deletion of payment records or records required for security or law.',
      ],
    },
    {
      heading: '5. Your choices',
      body: [
        'You can edit your profile, listings, and some settings in the app.',
        'You can submit an inquiry to ask what we hold, to correct it, or to request deletion where the law allows.',
        'You can stop using the service. Guest browsing collects less data than a paid account, but technical data for security may still be processed.',
      ],
    },
    {
      heading: '6. Children',
      body: [
        'The service is not directed at children who are not allowed to use Pi Network. If we learn that we hold an account that should not have been created, we will close it.',
      ],
    },
    {
      heading: '7. Security and storage',
      body: [
        'We use access controls, session tokens, and similar measures to protect accounts. No online service is completely secure. Do not send passwords or recovery phrases in chat or inquiries.',
        'Servers and storage may be in a different country from you. By using the service you understand that your information may be processed outside your country, with the safeguards we have with our providers.',
      ],
    },
    {
      heading: '8. Changes',
      body: [
        'We may update this Policy. The updated date will change at the top of this page. Continued use after a change means you accept the updated Policy.',
      ],
    },
    {
      heading: '9. Contact',
      body: [
        'For privacy requests, use Inquiry in the app. We do not publish the operator’s home address, personal phone number, or other private contact details on this page.',
      ],
    },
  ],
};

const TERMS_KO: LegalDoc = {
  title: '이용약관',
  updated: UPDATED,
  intro:
    '이 약관은 파이 네트워크를 쓰는 개인간 거래 마켓플레이스 Market PiePie의 이용 조건을 정합니다. 계정을 만들거나, 가입비를 내거나, 서비스를 쓰면 이 약관과 개인정보 처리방침에 동의한 것으로 봅니다. 이 문서는 서비스 운영 정책이며, 거주 국가 법률 자문을 대신하지 않습니다.',
  sections: [
    {
      heading: '1. 서비스',
      body: [
        'Market PiePie는 사용자가 물건을 올리고, 채팅하고, 가격을 제안하고, 직거래나 배송을 정하고, 후기를 남기고, 분쟁을 열 수 있는 온라인 장터입니다.',
        '운영자는 플랫폼만 제공합니다. 우리는 구매자나 판매자가 아니고, 사용자 사이 거래의 당사자가 아닙니다. 등록된 물건을 보관하지 않으며, 거래가 반드시 성사된다고 보장하지 않습니다.',
      ],
    },
    {
      heading: '2. 이용 자격',
      body: [
        '파이 네트워크 계정이 있어야 하며, 파이 네트워크 규칙과 이 약관을 함께 지켜야 합니다.',
        '파이 네트워크를 쓸 수 있는 나이여야 하고, 거주 지역에서 계약을 맺을 수 있어야 합니다. 사업 목적으로 쓰는 경우 그 사업을 대표할 권한이 있어야 합니다.',
      ],
    },
    {
      heading: '3. 계정과 가입비',
      body: [
        '회원 계정을 만들려면 파이로 내는 1회 가입비가 필요합니다. 결제 화면에 표시된 금액이 납부 금액입니다.',
        '결제는 파이 네트워크가 처리합니다. 계정이 만들어진 뒤에는 가입비를 환불하지 않습니다. 결제가 실패하면 계정은 만들어지지 않으며, 다시 시도할 수 있습니다.',
        '결제는 완료됐는데 프로필이 안 만들어진 경우, 다시 로그인하면 완료된 결제 기록으로 계정을 복구하며 가입비를 다시 받지 않습니다.',
        '계정에서 일어난 활동은 이용자 책임입니다. 파이 로그인을 공유하거나 다른 사람인 척하지 마세요.',
      ],
    },
    {
      heading: '4. 게시, 채팅, 거래',
      body: [
        '올린 글, 사진, 가격, 채팅, 제안, 약속·배송 정보, 후기는 작성한 사람의 책임입니다.',
        '이용자나 상대방이 있는 곳에서 불법이거나, 장물·위조품·위험물, 또는 다른 사람 권리를 침해하는 물건은 올리거나 거래하면 안 됩니다. 사기, 괴롭힘, 스팸, 후기·조회수·평점 조작을 하면 안 됩니다.',
        '직거래와 배송은 이용자끼리 정합니다. 거래 완료 전에 물건과 상대를 확인하세요. 우리는 물건 에스크로를 하지 않고, 배송도 하지 않습니다.',
      ],
    },
    {
      heading: '5. 이용자 사이 분쟁',
      body: [
        '거래에 문제가 있으면 앱의 분쟁 기능을 쓰고, 먼저 상대와 해결을 시도하세요.',
        '운영자는 신고·분쟁을 살펴 글을 숨기거나, 경고하거나, 계정을 정지할 수 있습니다. 법원 역할을 하지 않으며, 어느 한쪽에게 돈을 지급하거나 모든 분쟁을 판정할 의무는 없습니다.',
      ],
    },
    {
      heading: '6. 게시 내용',
      body: [
        '올린 내용의 권리는 이용자에게 있습니다. 다만 서비스를 운영하는 데 필요한 범위에서 그 내용을 저장·표시할 수 있는 비독점 허락을 받습니다.',
        '약관이나 법을 어기거나, 다른 이용자에게 해가 된다고 합리적으로 보는 내용은 삭제할 수 있습니다.',
      ],
    },
    {
      heading: '7. 이용 정지와 탈퇴',
      body: [
        '약관을 어기거나, 사기에 쓰이거나, 안전·법적 위험이 있는 계정은 정지하거나 닫을 수 있습니다.',
        '이용을 중단할 수 있습니다. 계정을 닫아도 이미 완료된 가입비 결제는 취소되지 않으며, 재결제를 막기 위해 남겨야 하는 결제 기록은 지워지지 않을 수 있습니다.',
      ],
    },
    {
      heading: '8. 파이 네트워크와 외부 서비스',
      body: [
        '파이 로그인과 파이 결제는 파이 네트워크가 제공합니다. 지갑, 결제 상태, 파이 계정 문제는 파이 네트워크 약관의 적용을 받습니다. 우리가 파이 결제를 임의로 되돌릴 수는 없습니다.',
        '이미지는 호스팅·저장 서비스에 올라갈 수 있습니다. 해당 사업자는 서비스 운영 목적으로만 처리합니다.',
      ],
    },
    {
      heading: '9. 면책과 책임 제한',
      body: [
        '서비스는 있는 그대로 제공됩니다. 끊김 없는 접속, 오류 없는 게시글, 상대방의 신뢰성을 약속하지 않습니다.',
        '법이 허용하는 한, 이용자 사이 거래, 설명과 다른 물건, 직거래·배송 문제, 파이 네트워크 장애, 채팅에 직접 적은 정보로 생긴 손해에 대해 책임을 지지 않습니다.',
        '법이 제한을 금지하는 책임(사기, 또는 제한이 허용되지 않는 사망·상해 등)은 이 약관으로 줄이지 않습니다.',
      ],
    },
    {
      heading: '10. 변경',
      body: [
        '약관은 바뀔 수 있습니다. 변경일은 이 페이지 위에 표시됩니다. 변경 후에도 서비스를 쓰면 새 약관에 동의한 것으로 봅니다. 동의하지 않으면 이용을 중단하세요.',
      ],
    },
    {
      heading: '11. 문의',
      body: [
        '약관 문의는 앱의 문의하기를 이용하세요. 운영자의 집 주소, 개인 전화번호, 그 밖의 사적 연락처는 이 페이지에 공개하지 않습니다.',
      ],
    },
  ],
};

const PRIVACY_KO: LegalDoc = {
  title: '개인정보 처리방침',
  updated: UPDATED,
  intro:
    '이 방침은 Market PiePie가 어떤 정보를 모으고, 왜 쓰며, 이용자에게 어떤 선택이 있는지를 설명합니다. 둘러보기, 가입, 거래에 적용됩니다. 정보 이용에 관한 결정은 Market PiePie 운영자가 합니다. 연락은 앱의 문의하기로 하세요.',
  sections: [
    {
      heading: '1. 수집하는 정보',
      body: [
        '파이가 허용한 계정 정보: 파이 사용자 번호, 파이 아이디, 권한을 준 경우 지갑 주소. 로그인, 가입비 기록, 재결제 방지에 씁니다.',
        '직접 입력한 프로필: 닉네임, 소개, 지역, 프로필 사진.',
        '거래 정보: 상품, 사진, 가격 제안, 주문, 제출한 약속·배송 정보, 채팅, 후기, 신고, 분쟁, 문의.',
        '결제 기록: 결제 번호, 금액, 상태, 거래 번호, 지갑 주소, 시각. 프로필이 나중에 없어도 계정을 복구하고 다시 받지 않기 위해 보관합니다.',
        '기술 정보: 기기·세션 식별 값, 접속 주소(IP), 기본 브라우저 정보. 로그인 유지, 조회수 조작 등 남용 제한, 서비스 보호에 씁니다.',
        '가입 조건으로 신분증이나 집 주소를 받지 않습니다. 게시글이나 채팅에 개인정보를 직접 쓰면 상대가 볼 수 있습니다.',
      ],
    },
    {
      heading: '2. 이용 목적',
      body: [
        '계정 생성·복구, 가입비 처리, 프로필 표시.',
        '상품, 채팅, 거래, 후기, 공지, 분쟁 운영.',
        '사기, 스팸, 가짜 조회, 타인 정보 무단 접근 방지.',
        '문의 답변 및 법령상 요청 대응.',
      ],
    },
    {
      heading: '3. 제공·위탁',
      body: [
        '다른 이용자에게는 공개하기로 한 정보(닉네임, 상품, 후기, 보낸 메시지)가 보입니다. 공개 화면에 파이 사용자 번호를 기본으로 보여 주지는 않습니다.',
        '로그인과 결제에 필요한 범위에서 파이 네트워크에 전달됩니다.',
        '호스팅, 데이터베이스, 이미지 저장 사업자는 서비스 운영을 위해 처리하며, 자체 마케팅에 쓰지 않습니다.',
        '법령상 의무가 있거나, 사기·중대한 피해를 막기 위해 필요한 경우 제공할 수 있습니다.',
        '개인정보를 판매하지 않습니다.',
      ],
    },
    {
      heading: '4. 보관 기간',
      body: [
        '계정·상품 정보는 이용 중과, 거래·분쟁 확인에 필요한 합리적인 기간 동안 보관합니다.',
        '완료된 가입비 기록은 재결제를 막고 관리자가 내역을 확인할 수 있도록 보관합니다.',
        '채팅, 주문, 분쟁은 서비스 운영과 신고 처리에 필요한 동안 보관합니다.',
        '문의하기로 정정·삭제를 요청할 수 있습니다. 결제 기록이나 보안·법령상 필요한 기록의 삭제는 거절할 수 있습니다.',
      ],
    },
    {
      heading: '5. 이용자 선택',
      body: [
        '앱에서 프로필, 상품, 일부 설정을 고칠 수 있습니다.',
        '문의하기로 보유 내용 확인, 정정, 법이 허용하는 삭제를 요청할 수 있습니다.',
        '이용을 중단할 수 있습니다. 게스트 둘러보기는 유료 회원보다 정보가 적지만, 보안을 위한 기술 정보는 처리될 수 있습니다.',
      ],
    },
    {
      heading: '6. 아동',
      body: [
        '파이 네트워크를 쓸 수 없는 아동을 대상으로 하지 않습니다. 만들어지면 안 되는 계정을 알게 되면 닫습니다.',
      ],
    },
    {
      heading: '7. 보안과 보관 장소',
      body: [
        '접근 제한, 로그인 토큰 등으로 계정을 보호합니다. 온라인 서비스가 완전히 안전하지는 않습니다. 비밀번호나 복구 문구를 채팅·문의에 보내지 마세요.',
        '서버와 저장소는 이용자와 다른 나라에 있을 수 있습니다. 서비스를 쓰면 정보가 국외에서 처리될 수 있음을 이해한 것으로 봅니다.',
      ],
    },
    {
      heading: '8. 변경',
      body: [
        '이 방침은 바뀔 수 있습니다. 변경일은 이 페이지 위에 표시됩니다. 변경 후 계속 이용하면 변경된 방침에 동의한 것으로 봅니다.',
      ],
    },
    {
      heading: '9. 문의',
      body: [
        '개인정보 관련 요청은 앱의 문의하기를 이용하세요. 운영자의 집 주소, 개인 전화번호, 그 밖의 사적 연락처는 이 페이지에 공개하지 않습니다.',
      ],
    },
  ],
};

export function getLegalDoc(kind: LegalKind, lang: AppLanguage): LegalDoc {
  if (lang === 'ko') return kind === 'terms' ? TERMS_KO : PRIVACY_KO;
  return kind === 'terms' ? TERMS_EN : PRIVACY_EN;
}
