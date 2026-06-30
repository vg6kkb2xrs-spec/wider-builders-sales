export const config = {
  api: {
    bodyParser: {
      sizeLimit: '8mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { imageBase64, mediaType, projectAddresses } = req.body

  if (!imageBase64) {
    return res.status(400).json({ error: 'Missing image' })
  }

  try {
    const projectList = (projectAddresses || []).slice(0, 30).join(', ')

    const isPdf = (mediaType || '').includes('pdf')
    const fileBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imageBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 } }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        messages: [
          {
            role: 'user',
            content: [
              fileBlock,
              {
                type: 'text',
                text: `קרא את הקבלה/חשבונית הזו וחלץ את הפרטים הבאים. החזר אך ורק JSON תקין, ללא טקסט נוסף, ללא markdown.

שדות נדרשים:
- transaction_type: בחר ערך אחד בדיוק מהרשימה הזו (באנגלית, בדיוק כפי שכתוב): "Client Deposit", "New Bill", "Bill Payment", "Material Expense", "Labor Expense", "Vendor Refund", "General Expense"
  כללי אצבע: קבלה מחנות חומרי בניין = Material Expense. תשלום לעובד/קבלן משנה = Labor Expense. חשבונית שהתקבלה מספק שטרם שולמה = New Bill. תשלום בפועל על חשבונית = Bill Payment. מקדמה מלקוח = Client Deposit. החזר מספק = Vendor Refund. כל השאר = General Expense.
- amount: מספר בלבד (ללא סימן מטבע)
- payment_method: בחר ערך אחד בדיוק מהרשימה הזו אם ברור מהמסמך, אחרת null: "Check", "Zelle", "Company Debit Card 4699", "Material Account 2961", "Tzvi personal", "Israel Amex", "ATM", "Cash", "Paid by contractor", "Paid by Client", "Not paid"
- memo: תיאור קצר של מה נקנה, באנגלית, עד 8 מילים (לדוגמה: "Tile adhesive bags", "Subcontractor payment")
- vendor: שם הספק/חנות אם מופיע
- project_guess: אם יש רמז לאיזה פרויקט זה שייך, בחר מהרשימה הזו אם מתאים: [${projectList}], אחרת null

דוגמת פלט:
{"transaction_type":"Material Expense","amount":1240.50,"payment_method":"Company Debit Card 4699","memo":"חומרי בניין חיפוי","vendor":"Home Depot","project_guess":null}`,
              },
            ],
          },
        ],
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Anthropic API error:', data)
      return res.status(500).json({ error: data.error?.message || 'OCR failed' })
    }

    const text = data.content?.[0]?.text || ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return res.status(200).json(parsed)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}


