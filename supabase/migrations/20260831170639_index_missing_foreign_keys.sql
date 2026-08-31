-- Cubre las FKs señaladas por el advisor de performance: se usan en el join
-- del dashboard (transactions.product_id) y en el cascade de cuotas (installments.transaction_id).
create index transactions_product_id_idx on transactions (product_id);
create index installments_transaction_id_idx on installments (transaction_id);
