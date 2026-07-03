CREATE TABLE IF NOT EXISTS new_tokens
(
    slot                UInt64,
    block_time          DateTime('UTC'),
    tx_signature        String,
    instruction_index   UInt16,
    program_id          LowCardinality(String),
    mint                String,
    decimals            UInt8,
    mint_authority      Nullable(String),
    freeze_authority    Nullable(String),
    init_method         LowCardinality(String)
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(block_time)
ORDER BY (mint);
