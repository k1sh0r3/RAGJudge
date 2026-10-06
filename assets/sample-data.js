/* RAGJudge — bundled sample dataset (all content is fictional, written for this demo). */
(function (root) {
  root.RAGJudge = root.RAGJudge || {};
  var T = root.RAGJudge;

  var SAMPLE_DOCS = [
    {
      id: 'manual',
      title: 'AeroBrew 3000 — User Manual (fictional)',
      sections: [
        { id: 'safety', heading: 'Safety',
          text: 'Safety first. Always unplug the AeroBrew 3000 before cleaning. Never immerse the base unit in water. Keep the power cord away from hot surfaces. The carafe and brew basket are dishwasher safe on the top rack only.' },
        { id: 'unboxing', heading: 'Unboxing and first use',
          text: 'Remove all packaging materials. Wash the carafe, brew basket, and water reservoir with warm soapy water. Fill the reservoir to the MAX line and run one full brew cycle with water only to flush the system. Discard the water before brewing coffee.' },
        { id: 'brewing', heading: 'Brewing coffee',
          text: 'The AeroBrew 3000 brews at 92 degrees Celsius, the ideal temperature for extraction. Use medium-coarse ground coffee at 10 grams per 180 milliliters of water. Select Regular or Bold on the strength dial. A full 12-cup pot brews in about 8 minutes.' },
        { id: 'cleaning', heading: 'Cleaning and descaling',
          text: 'Rinse the carafe and brew basket after every use. Descale every 3 months with a 1 to 1 mix of white vinegar and water, then run two clean-water cycles. Wipe the base unit with a damp cloth. Never use abrasive cleaners on any part.' },
        { id: 'warranty', heading: 'Warranty',
          text: 'The AeroBrew 3000 carries a 2-year limited warranty covering defects in materials and workmanship. Register your product within 30 days at aerobreware.example.com. The warranty does not cover normal wear, misuse, or commercial use.' },
        { id: 'troubleshooting', heading: 'Troubleshooting',
          text: 'Weak coffee: use a finer grind or the Bold setting, and check the 10 grams per 180 milliliters ratio. Machine will not start: confirm it is plugged in and the reservoir is seated correctly. Slow brewing: descale the machine. Leaking: ensure the carafe lid is closed and the brew basket is fully inserted.' }
      ]
    },
    {
      id: 'policy',
      title: 'Nimbus Labs — Remote Work Policy (fictional)',
      sections: [
        { id: 'eligibility', heading: 'Eligibility',
          text: 'Full-time employees who have completed 90 days of employment may work remotely up to 3 days per week. Roles requiring on-site lab access are excluded. Contractors are not eligible under this policy.' },
        { id: 'hours', heading: 'Working hours',
          text: 'Core collaboration hours are 10am to 3pm Eastern, Monday through Friday. Outside core hours, employees may set their own schedule with manager approval. All-hands meetings are Wednesdays at 11am Eastern.' },
        { id: 'equipment', heading: 'Equipment',
          text: 'Nimbus provides a laptop, monitor, keyboard, and mouse for home offices. Employees may expense up to 500 dollars for an ergonomic chair. Internet costs are reimbursed up to 75 dollars per month with receipts.' },
        { id: 'security', heading: 'Security',
          text: 'Remote employees must use the company VPN at all times and enable full-disk encryption. Do not store customer data on personal devices. Report lost or stolen equipment within 24 hours.' },
        { id: 'expenses', heading: 'Expenses',
          text: 'Submit home-office expenses monthly through Expensify. Reimbursement is issued within 14 days of approval. Expenses over 200 dollars require pre-approval from your manager.' }
      ]
    }
  ];

  var SAMPLE_QUESTIONS = [
    { id: 'q1', question: 'How long is the AeroBrew 3000 warranty?',
      reference: '2 years.',
      goldSections: ['manual:warranty'] },
    { id: 'q2', question: 'What should you do before using the AeroBrew for the first time?',
      reference: 'Wash the removable parts and run one full brew cycle with water only.',
      goldSections: ['manual:unboxing'] },
    { id: 'q3', question: 'At what temperature does the AeroBrew 3000 brew coffee?',
      reference: '92 degrees Celsius.',
      goldSections: ['manual:brewing'] },
    { id: 'q4', question: 'How often should you descale the AeroBrew, and with what?',
      reference: 'Every 3 months with a 1 to 1 mix of white vinegar and water.',
      goldSections: ['manual:cleaning'] },
    { id: 'q5', question: 'What should you do if the coffee tastes weak?',
      reference: 'Use a finer grind or the Bold setting and check the coffee-to-water ratio.',
      goldSections: ['manual:troubleshooting'] },
    { id: 'q6', question: 'Who is eligible to work remotely at Nimbus Labs?',
      reference: 'Full-time employees after 90 days, up to 3 days per week; contractors are excluded.',
      goldSections: ['policy:eligibility'] },
    { id: 'q7', question: 'What are the core collaboration hours at Nimbus Labs?',
      reference: '10am to 3pm Eastern, Monday through Friday.',
      goldSections: ['policy:hours'] },
    { id: 'q8', question: 'What home-office equipment does Nimbus Labs provide or reimburse?',
      reference: 'Laptop, monitor, keyboard, mouse; up to $500 for a chair; up to $75/month for internet.',
      goldSections: ['policy:equipment'] },
    { id: 'q9', question: 'What security rules apply when working remotely for Nimbus Labs?',
      reference: 'Use the company VPN, enable full-disk encryption, and keep customer data off personal devices.',
      goldSections: ['policy:security'] },
    { id: 'q10', question: 'How do you get reimbursed for home-office expenses?',
      reference: 'Submit monthly via Expensify; paid within 14 days of approval; over $200 needs pre-approval.',
      goldSections: ['policy:expenses'] }
  ];

  T.SAMPLE_DOCS = SAMPLE_DOCS;
  T.SAMPLE_QUESTIONS = SAMPLE_QUESTIONS;
})(typeof window !== 'undefined' ? window : globalThis);
