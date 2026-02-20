const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SalesScorecard2024!@sales-scorecard-db.cvmwi48oaptu.eu-north-1.rds.amazonaws.com:5432/sales_scorecard',
  ssl: { rejectUnauthorized: false }
});

async function seedHighShareForm() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    console.log('🌱 Seeding High Share of Wallet Evaluation Form...\n');
    
    // High Share form categories for SALESPERSON evaluation
    const highShareCategories = [
      {
        id: crypto.randomUUID(),
        name: 'Preparation Before the Meeting (SALESPERSON) HIGH_SHARE',
        order: 1,
        weight: 0.25,
        items: [
          {
            name: 'Identify core products the client uses (in their menu) but does not buy from METRO',
            order: 1,
            scores: {
              1: { bg: 'Без подготовка, няма идея какво използва клиентът', en: 'No preparation, no idea what client uses' },
              2: { bg: 'Знае 1-2 продукта неясно', en: 'Knows 1–2 products vaguely' },
              3: { bg: 'Знае няколко продукта, но не напълно точно', en: 'Knows several products, but not fully accurate' },
              4: { bg: 'Ясен списък на ключови продукти липсващи от МЕТРО поръчки', en: 'Clear list of key products missing from METRO orders' }
            }
          },
          {
            name: 'Determined type of establishment (restaurant/hotel) and cuisine style',
            order: 2,
            scores: {
              1: { bg: 'Без информация за типа клиент', en: 'No info about the client type' },
              2: { bg: 'Обща информация, не прецизна (напр. "ресторант")', en: 'Generic info, not precise (e.g. "restaurant")' },
              3: { bg: 'Знае типа и някои детайли за кухнята', en: 'Knows type and some details about cuisine' },
              4: { bg: 'Ясен профил: тип + кухня + позициониране', en: 'Clear profile: type + cuisine + positioning' }
            }
          },
          {
            name: 'Selected 1–2 focus products for the meeting',
            order: 3,
            scores: {
              1: { bg: 'Без избрани фокусни продукти', en: 'No chosen focus products' },
              2: { bg: 'Спомена продукт но без стратегия', en: 'Mentioned a product but without strategy' },
              3: { bg: 'Избра продукти но слабо съответствие с нуждите на клиента', en: 'Selected products but weak alignment with client needs' },
              4: { bg: 'Ясен избор на 1-2 продукта релевантни за клиента + МЕТРО цели', en: 'Clear choice of 1–2 products relevant for client + METRO goals' }
            }
          },
          {
            name: 'Knows where the client currently orders from and why',
            order: 4,
            scores: {
              1: { bg: 'Без информация', en: 'No information' },
              2: { bg: 'Предположения, много обща информация', en: 'Guessing, very general knowledge' },
              3: { bg: 'Знае източника но неясни причини', en: 'Knows source but unclear reasons' },
              4: { bg: 'Знае доставчика + точни причини за избора (цена, доставка, качество)', en: 'Knows supplier + exact reasons for choice (price, delivery, quality)' }
            }
          },
          {
            name: 'Analyzed client\'s restaurant prices and quality/price preferences',
            order: 5,
            scores: {
              1: { bg: 'Без проверка на цени или предпочитания', en: 'No check on prices or preferences' },
              2: { bg: 'Приблизителна представа, не потвърдена', en: 'Rough idea, not confirmed' },
              3: { bg: 'Провери частично (цени ИЛИ предпочитания)', en: 'Checked partially (prices OR preferences)' },
              4: { bg: 'Ясно познаване на ценово ниво + баланс качество/цена на клиента', en: 'Clear knowledge of price level + client\'s price/quality balance' }
            }
          },
          {
            name: 'Prepared strategy for focus product (e.g. which mozzarella, which brand)',
            order: 6,
            scores: {
              1: { bg: 'Без подготвена стратегия', en: 'No strategy prepared' },
              2: { bg: 'Много обще предложение (напр. "предложи моцарела")', en: 'Very generic proposal (e.g. "offer mozzarella")' },
              3: { bg: 'Избра продукт но не напълно обоснован', en: 'Selected product but not fully justified' },
              4: { bg: 'Ясна стратегия: конкретен продукт + съответствие с консумация на клиента и цели на МЕТРО', en: 'Clear strategy: specific product + aligned with client consumption and METRO targets' }
            }
          },
          {
            name: 'Visit aligned with METRO contact model',
            order: 7,
            scores: {
              1: { bg: 'Случайно посещение, без съответствие', en: 'Random visit, no alignment' },
              2: { bg: 'Частично съответствие, слаба връзка с модела', en: 'Partially aligned, weak link to model' },
              3: { bg: 'Съответства но изпълнението непълно', en: 'Aligned but execution incomplete' },
              4: { bg: 'Напълно съответства с контактния модел и сегментационната стратегия', en: 'Fully aligned with contact model and segmentation strategy' }
            }
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Problem Definition (SALESPERSON) HIGH_SHARE',
        order: 2,
        weight: 0.25,
        items: [
          {
            name: 'Did the salesperson ask about opportunities to improve collaboration with METRO?',
            order: 1,
            scores: {
              1: { bg: 'Не попита', en: 'Did not ask' },
              2: { bg: 'Попита повърхностно, без изслушване', en: 'Asked superficially, no listening' },
              3: { bg: 'Попита правилно но без дълбочина', en: 'Asked properly but no depth' },
              4: { bg: 'Идентифицира ясни възможности', en: 'Identified improvement opportunities' }
            }
          },
          {
            name: 'Did the salesperson propose specific products (prepared in advance) for the customer to start sourcing from METRO?',
            order: 2,
            scores: {
              1: { bg: 'Няма предложение', en: 'No proposal' },
              2: { bg: 'Общи/неподготвени предложения', en: 'Generic or unprepared proposal' },
              3: { bg: 'Подготвени и релевантни предложения', en: 'Prepared and relevant proposal' },
              4: { bg: 'Стратегически предложения, свързани с клиента', en: 'Strategic proposal aligned with customer needs' }
            }
          },
          {
            name: 'Did the salesperson connect the customer\'s long-term goals with the proposed new products?',
            order: 3,
            scores: {
              1: { bg: 'Без връзка', en: 'No connection' },
              2: { bg: 'Частична връзка', en: 'Weak connection' },
              3: { bg: 'Ясна връзка с ползите', en: 'Clear link to customer benefits' },
              4: { bg: 'Убедителна стратегическа връзка', en: 'Strong strategic alignment, persuasive' }
            }
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Handling Objections (SALESPERSON) HIGH_SHARE',
        order: 3,
        weight: 0.25,
        items: [
          {
            name: 'Listened fully to objection without interrupting',
            order: 1,
            scores: {
              1: { bg: 'Прекъсна', en: 'Interrupted' },
              2: { bg: 'Слуша частично', en: 'Listened partially' },
              3: { bg: 'Слуша но слаба реакция', en: 'Listened but weak reaction' },
              4: { bg: 'Пълно, спокойно слушане', en: 'Full, calm listening' }
            }
          },
          {
            name: 'Validated client\'s perspective',
            order: 2,
            scores: {
              1: { bg: 'Игнорира', en: 'Ignored' },
              2: { bg: 'Защитен отговор', en: 'Defensive response' },
              3: { bg: 'Частично признание', en: 'Partial acknowledgement' },
              4: { bg: 'Пълна валидация, емпатия', en: 'Full validation, empathy' }
            }
          },
          {
            name: 'Put objection in market context & showed METRO\'s response',
            order: 3,
            scores: {
              1: { bg: 'Игнорира контекста', en: 'Ignored context' },
              2: { bg: 'Спомена неясно', en: 'Mentioned vaguely' },
              3: { bg: 'Слаб пример', en: 'Weak example' },
              4: { bg: 'Ясно обяснение, показа подхода на МЕТРО', en: 'Clear explanation, showed METRO\'s approach' }
            }
          }
        ]
      },
      {
        id: crypto.randomUUID(),
        name: 'Commercial Proposal (SALESPERSON) HIGH_SHARE',
        order: 4,
        weight: 0.25,
        items: [
          {
            name: 'Did the salesperson present a product/service as a sustainable partnership solution with METRO?',
            order: 1,
            scores: {
              1: { bg: 'Без представяне', en: 'No value presentation' },
              2: { bg: 'Повърхностно', en: 'Generic message' },
              3: { bg: 'Ясно позиционирана стойност', en: 'Clear value positioning' },
              4: { bg: 'Силно и доказано партньорско решение', en: 'Strong, credible partnership solution' }
            }
          },
          {
            name: 'Did the salesperson emphasize the customer benefits of adding more products?',
            order: 2,
            scores: {
              1: { bg: 'Без ползи', en: 'No benefits explained' },
              2: { bg: 'Общи ползи', en: 'General benefits only' },
              3: { bg: 'Конкретни и релевантни ползи', en: 'Clear and relevant benefits' },
              4: { bg: 'Персонализирани и мотивиращи ползи', en: 'Tailored and motivating benefits' }
            }
          },
          {
            name: 'Proposed test of key products',
            order: 3,
            scores: {
              1: { bg: 'Не предложи', en: 'Did not propose' },
              2: { bg: 'Спомена без детайл', en: 'Mentioned without detail' },
              3: { bg: 'Предложи но слабо', en: 'Proposed but weakly' },
              4: { bg: 'Силно, уверено предложение за тест', en: 'Strong, confident proposal for test' }
            }
          },
          {
            name: 'Did the salesperson agree on a next step with a longer-term perspective?',
            order: 4,
            scores: {
              1: { bg: 'Без следваща стъпка', en: 'No next step' },
              2: { bg: 'Неясно споменаване', en: 'Vague mention' },
              3: { bg: 'Споразумение но неясно', en: 'Agreement but unclear' },
              4: { bg: 'Ясна, конкретна следваща стъпка договорена', en: 'Clear, specific next step agreed' }
            }
          }
        ]
      }
    ];
    
    // Insert categories and items
    for (const category of highShareCategories) {
      console.log(`  📂 Creating category: ${category.name}`);
      
      await client.query(
        `INSERT INTO behavior_categories (id, name, "order", weight, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "order" = EXCLUDED."order", weight = EXCLUDED.weight, "updatedAt" = NOW()`,
        [category.id, category.name, category.order, category.weight]
      );
      
      for (const item of category.items) {
        const itemId = crypto.randomUUID();
        console.log(`    ✓ ${item.name}`);
        
        await client.query(
          `INSERT INTO behavior_items (id, "categoryId", name, "order", "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, "order" = EXCLUDED."order", "updatedAt" = NOW()`,
          [itemId, category.id, item.name, item.order, true]
        );
      }
    }
    
    await client.query('COMMIT');
    console.log('\n✅ High Share evaluation form seeded successfully!\n');
    
    // Verify
    const countResult = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM behavior_categories WHERE name LIKE '%HIGH_SHARE%') as categories,
        (SELECT COUNT(*) FROM behavior_items bi
         JOIN behavior_categories bc ON bc.id = bi."categoryId"
         WHERE bc.name LIKE '%HIGH_SHARE%') as items
    `);
    
    console.log('📊 Summary:');
    console.log(`  High Share Categories: ${countResult.rows[0].categories}`);
    console.log(`  High Share Items: ${countResult.rows[0].items}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding high share form:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedHighShareForm().catch(console.error);

