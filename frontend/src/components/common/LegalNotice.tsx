import React from 'react';

export const LegalNotice: React.FC = () => {
  return (
    <div className="bg-gray-50 border-t border-gray-200 py-4 px-4 text-xs text-gray-600">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <button type="button" className="hover:underline">Terms of service</button>
          <button type="button" className="hover:underline">Privacy policy</button>
          <button type="button" className="hover:underline">E-commerce notice</button>
          <button type="button" className="hover:underline">Help center</button>
        </div>
        <div className="text-gray-500">
          <p>Company: MarketPiePie Inc. | CEO: Hong Gildong</p>
          <p>Address: 123 Teheran-ro, Gangnam-gu, Seoul</p>
          <p>Business reg. 123-45-67890 | Online sales registration: 2024-Seoul Gangnam-0001</p>
          <p>Hosting: AWS | Contact: support@marketpiepie.com</p>
        </div>
        <div className="text-gray-500 pt-2 border-t border-gray-200">
          <p className="font-medium mb-1">
            We operate as an intermediary and are not a party to transactions. We are not responsible for listings or
            trades between users.
          </p>
        </div>
      </div>
    </div>
  );
};
