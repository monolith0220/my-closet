-- Optional explicit closet group and subcategory. Existing rows remain null and
-- continue to use the legacy category and product-name inference in the client.
alter table public.clothing_items
  add column category_group text,
  add column subcategory text,
  add constraint clothing_items_explicit_category_pair check (
    (category_group is null and subcategory is null)
    or (
      category_group is not null and subcategory is not null and (
        (category_group = 'アウター' and subcategory in ('ブルゾン', 'ジャケット', 'ダウン', 'コート', 'パーカ', 'その他'))
        or (category_group = 'トップス' and subcategory in ('Tシャツ', 'シャツ・ブラウス', 'ニット', 'スウェット', 'カーディガン', 'インナー', 'その他'))
        or (category_group = 'ボトムス' and subcategory in ('パンツ', 'デニム', 'ショートパンツ', 'スカート', 'インナー', 'ルームウェア', 'その他'))
        or (category_group = 'レッグウェア' and subcategory in ('ソックス', 'タイツ', 'レギンス', 'レッグウォーマー', 'その他'))
        or (category_group = 'アクセサリー' and subcategory in ('バッグ', 'シューズ', '帽子', 'ベルト', 'ファッション小物', 'その他'))
        or (category_group = 'その他' and subcategory in ('ワンピース', 'ルームウェア', '雑貨', 'その他'))
      )
    )
  );
