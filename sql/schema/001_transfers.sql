CREATE TABLE IF NOT EXISTS transfers
(
    slot                UInt64,
    block_time          DateTime('UTC'),
    tx_signature        String,
    tx_index            UInt32,
    instruction_index   UInt16,
    inner_index         Nullable(UInt16),
    program_id          LowCardinality(String),
    transfer_type       LowCardinality(String),
    mint                String,
    decimals            Nullable(UInt8),
    source              String,
    destination         String,
    authority           String,
    amount_raw          UInt64,
    amount_ui           Float64
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(block_time)
ORDER BY (mint, block_time, tx_signature, instruction_index);
