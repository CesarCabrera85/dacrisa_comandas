-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol_tag" TEXT NOT NULL,
    "funcion" TEXT,
    "estado" TEXT NOT NULL,
    "baja_motivo" TEXT,
    "baja_inicio" TIMESTAMPTZ,
    "baja_fin" TIMESTAMPTZ,
    "codigo_lookup" BYTEA NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "codigo_enc" BYTEA NOT NULL,
    "codigo_enc_iv" BYTEA NOT NULL,
    "codigo_enc_tag" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_familia_permitida" (
    "usuario_id" UUID NOT NULL,
    "codigo_funcional" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_familia_permitida_pkey" PRIMARY KEY ("usuario_id","codigo_funcional")
);

-- CreateTable
CREATE TABLE "turno_horario" (
    "id" UUID NOT NULL,
    "franja" TEXT NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turno_horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "franja" TEXT NOT NULL,
    "jefe_id" UUID,
    "estado" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ,
    "ended_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turno_usuario_familia_habilitada" (
    "turno_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "codigo_funcional" SMALLINT NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turno_usuario_familia_habilitada_pkey" PRIMARY KEY ("turno_id","usuario_id","codigo_funcional")
);

-- CreateTable
CREATE TABLE "codigo_funcional_def" (
    "codigo_funcional" SMALLINT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "codigo_funcional_def_pkey" PRIMARY KEY ("codigo_funcional")
);

-- CreateTable
CREATE TABLE "rutas_master_version" (
    "id" UUID NOT NULL,
    "version_label" TEXT NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "archivo_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "validacion_estado" TEXT NOT NULL,
    "validacion_resumen" JSONB NOT NULL DEFAULT '{}',
    "activated_at" TIMESTAMPTZ,
    "activated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rutas_master_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutas_master" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "ruta_raw" TEXT NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rutas_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_master_version" (
    "id" UUID NOT NULL,
    "version_label" TEXT NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "archivo_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "validacion_estado" TEXT NOT NULL,
    "validacion_resumen" JSONB NOT NULL DEFAULT '{}',
    "activated_at" TIMESTAMPTZ,
    "activated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_master_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productos_master" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "producto_raw" TEXT NOT NULL,
    "producto_norm" TEXT NOT NULL,
    "familia" SMALLINT NOT NULL,
    "codigo_producto" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "productos_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ruta_dia" (
    "id" UUID NOT NULL,
    "turno_id" UUID NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "estado_visual" TEXT NOT NULL,
    "estado_logico" TEXT NOT NULL,
    "reactivaciones_count" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ruta_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colecta_asignacion" (
    "turno_id" UUID NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "colecta_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colecta_asignacion_pkey" PRIMARY KEY ("turno_id","ruta_norm")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" UUID NOT NULL,
    "ruta_dia_id" UUID,
    "imap_uid" BIGINT NOT NULL,
    "imap_uidvalidity" BIGINT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL,
    "business_date" DATE NOT NULL,
    "subject_raw" TEXT NOT NULL,
    "body_raw" TEXT NOT NULL,
    "parse_status" TEXT NOT NULL,
    "productos_version_id" UUID NOT NULL,
    "rutas_version_id" UUID NOT NULL,
    "original_turno_id" UUID,
    "carried_over" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_cliente" (
    "id" UUID NOT NULL,
    "lote_id" UUID NOT NULL,
    "codigo_cliente" TEXT NOT NULL,
    "nombre_cliente_raw" TEXT,
    "localidad_raw" TEXT,
    "cliente_affinity_key" TEXT NOT NULL,
    "observaciones" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linea" (
    "id" UUID NOT NULL,
    "pedido_cliente_id" UUID NOT NULL,
    "seq_in_cliente" INTEGER NOT NULL,
    "cantidad" DECIMAL(14,6) NOT NULL,
    "unidad_raw" TEXT NOT NULL,
    "producto_raw" TEXT NOT NULL,
    "producto_norm" TEXT NOT NULL,
    "precio_raw" TEXT,
    "precio_num" DECIMAL(18,10),
    "moneda" CHAR(3),
    "match_method" TEXT NOT NULL,
    "match_score" DECIMAL(6,4),
    "familia" SMALLINT NOT NULL,
    "codigo_funcional" SMALLINT NOT NULL,
    "operario_id" UUID,
    "assigned_at" TIMESTAMPTZ,
    "printed_at" TIMESTAMPTZ,
    "print_count" INTEGER NOT NULL DEFAULT 0,
    "linea_observacion" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_afinidad" (
    "turno_id" UUID NOT NULL,
    "cliente_affinity_key" TEXT NOT NULL,
    "codigo_funcional" SMALLINT NOT NULL,
    "operario_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_afinidad_pkey" PRIMARY KEY ("turno_id","cliente_affinity_key","codigo_funcional")
);

-- CreateTable
CREATE TABLE "rr_cursor" (
    "turno_id" UUID NOT NULL,
    "codigo_funcional" SMALLINT NOT NULL,
    "last_operario_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rr_cursor_pkey" PRIMARY KEY ("turno_id","codigo_funcional")
);

-- CreateTable
CREATE TABLE "operario_ruta_progress" (
    "turno_id" UUID NOT NULL,
    "operario_id" UUID NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "login_at" TIMESTAMPTZ NOT NULL,
    "cutoff_lote_id" UUID,
    "last_printed_lote_id" UUID,
    "last_printed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operario_ruta_progress_pkey" PRIMARY KEY ("turno_id","operario_id","ruta_norm")
);

-- CreateTable
CREATE TABLE "colecta_ruta_progress" (
    "turno_id" UUID NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "last_closed_lote_id" UUID,
    "last_closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "colecta_ruta_progress_pkey" PRIMARY KEY ("turno_id","ruta_norm")
);

-- CreateTable
CREATE TABLE "print_jobs" (
    "id" UUID NOT NULL,
    "turno_id" UUID NOT NULL,
    "ruta_norm" TEXT NOT NULL,
    "actor_user_id" UUID,
    "tipo" TEXT NOT NULL,
    "cutoff_lote_id" UUID,
    "from_lote_id" UUID,
    "to_lote_id" UUID,
    "status" TEXT NOT NULL,
    "pdf_path" TEXT,
    "error_text" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "print_job_items" (
    "print_job_id" UUID NOT NULL,
    "linea_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "print_job_items_pkey" PRIMARY KEY ("print_job_id","linea_id")
);

-- CreateTable
CREATE TABLE "eventos" (
    "id" UUID NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "tipo" TEXT NOT NULL,
    "entidad_tipo" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "eventos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "device_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imap_state" (
    "id" UUID NOT NULL,
    "mailbox" TEXT NOT NULL DEFAULT 'INBOX',
    "uidvalidity" BIGINT,
    "last_uid" BIGINT NOT NULL DEFAULT 0,
    "last_poll_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imap_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_codigo_lookup_key" ON "usuarios"("codigo_lookup");

-- CreateIndex
CREATE INDEX "idx_usuarios_estado" ON "usuarios"("estado");

-- CreateIndex
CREATE INDEX "idx_ufp_codigo" ON "usuario_familia_permitida"("codigo_funcional");

-- CreateIndex
CREATE INDEX "idx_turno_estado" ON "turnos"("estado");

-- CreateIndex
CREATE UNIQUE INDEX "turnos_fecha_franja_key" ON "turnos"("fecha", "franja");

-- CreateIndex
CREATE INDEX "idx_tufh_turno_codigo" ON "turno_usuario_familia_habilitada"("turno_id", "codigo_funcional");

-- CreateIndex
CREATE INDEX "idx_rutas_master_version" ON "rutas_master"("version_id");

-- CreateIndex
CREATE INDEX "idx_rutas_master_norm" ON "rutas_master"("ruta_norm");

-- CreateIndex
CREATE INDEX "idx_productos_master_version" ON "productos_master"("version_id");

-- CreateIndex
CREATE INDEX "idx_productos_master_norm" ON "productos_master"("producto_norm");

-- CreateIndex
CREATE INDEX "idx_productos_master_familia" ON "productos_master"("familia");

-- CreateIndex
CREATE INDEX "idx_ruta_dia_turno" ON "ruta_dia"("turno_id");

-- CreateIndex
CREATE INDEX "idx_ruta_dia_estado_visual" ON "ruta_dia"("estado_visual");

-- CreateIndex
CREATE INDEX "idx_ruta_dia_ruta" ON "ruta_dia"("ruta_norm");

-- CreateIndex
CREATE UNIQUE INDEX "ruta_dia_turno_id_ruta_norm_key" ON "ruta_dia"("turno_id", "ruta_norm");

-- CreateIndex
CREATE INDEX "idx_colecta_user" ON "colecta_asignacion"("colecta_user_id");

-- CreateIndex
CREATE INDEX "idx_lote_ruta_dia" ON "lote"("ruta_dia_id", "received_at");

-- CreateIndex
CREATE INDEX "idx_lote_business_date" ON "lote"("business_date");

-- CreateIndex
CREATE UNIQUE INDEX "lote_imap_uidvalidity_imap_uid_key" ON "lote"("imap_uidvalidity", "imap_uid");

-- CreateIndex
CREATE INDEX "idx_pedido_cliente_lote" ON "pedido_cliente"("lote_id");

-- CreateIndex
CREATE INDEX "idx_pedido_cliente_affinity" ON "pedido_cliente"("cliente_affinity_key");

-- CreateIndex
CREATE INDEX "idx_linea_pedido" ON "linea"("pedido_cliente_id", "seq_in_cliente");

-- CreateIndex
CREATE INDEX "idx_linea_match_method" ON "linea"("match_method");

-- CreateIndex
CREATE INDEX "idx_owner_operario" ON "owner_afinidad"("operario_id");

-- CreateIndex
CREATE INDEX "idx_orp_ruta" ON "operario_ruta_progress"("turno_id", "ruta_norm");

-- CreateIndex
CREATE INDEX "idx_print_jobs_turno_ruta" ON "print_jobs"("turno_id", "ruta_norm");

-- CreateIndex
CREATE INDEX "idx_print_jobs_actor" ON "print_jobs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_print_jobs_status" ON "print_jobs"("status");

-- CreateIndex
CREATE INDEX "idx_eventos_ts" ON "eventos"("ts" DESC);

-- CreateIndex
CREATE INDEX "idx_eventos_tipo" ON "eventos"("tipo");

-- CreateIndex
CREATE INDEX "idx_eventos_entidad" ON "eventos"("entidad_tipo", "entidad_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_sessions_token" ON "sessions"("session_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "imap_state_mailbox_key" ON "imap_state"("mailbox");

-- AddForeignKey
ALTER TABLE "usuario_familia_permitida" ADD CONSTRAINT "usuario_familia_permitida_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_jefe_id_fkey" FOREIGN KEY ("jefe_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_usuario_familia_habilitada" ADD CONSTRAINT "turno_usuario_familia_habilitada_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_usuario_familia_habilitada" ADD CONSTRAINT "turno_usuario_familia_habilitada_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_master_version" ADD CONSTRAINT "rutas_master_version_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutas_master" ADD CONSTRAINT "rutas_master_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "rutas_master_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_master_version" ADD CONSTRAINT "productos_master_version_activated_by_fkey" FOREIGN KEY ("activated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productos_master" ADD CONSTRAINT "productos_master_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "productos_master_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ruta_dia" ADD CONSTRAINT "ruta_dia_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colecta_asignacion" ADD CONSTRAINT "colecta_asignacion_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colecta_asignacion" ADD CONSTRAINT "colecta_asignacion_colecta_user_id_fkey" FOREIGN KEY ("colecta_user_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_ruta_dia_id_fkey" FOREIGN KEY ("ruta_dia_id") REFERENCES "ruta_dia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_productos_version_id_fkey" FOREIGN KEY ("productos_version_id") REFERENCES "productos_master_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_rutas_version_id_fkey" FOREIGN KEY ("rutas_version_id") REFERENCES "rutas_master_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_original_turno_id_fkey" FOREIGN KEY ("original_turno_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_cliente" ADD CONSTRAINT "pedido_cliente_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea" ADD CONSTRAINT "linea_pedido_cliente_id_fkey" FOREIGN KEY ("pedido_cliente_id") REFERENCES "pedido_cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "linea" ADD CONSTRAINT "linea_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_afinidad" ADD CONSTRAINT "owner_afinidad_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_afinidad" ADD CONSTRAINT "owner_afinidad_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rr_cursor" ADD CONSTRAINT "rr_cursor_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rr_cursor" ADD CONSTRAINT "rr_cursor_last_operario_id_fkey" FOREIGN KEY ("last_operario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operario_ruta_progress" ADD CONSTRAINT "operario_ruta_progress_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operario_ruta_progress" ADD CONSTRAINT "operario_ruta_progress_operario_id_fkey" FOREIGN KEY ("operario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operario_ruta_progress" ADD CONSTRAINT "operario_ruta_progress_cutoff_lote_id_fkey" FOREIGN KEY ("cutoff_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operario_ruta_progress" ADD CONSTRAINT "operario_ruta_progress_last_printed_lote_id_fkey" FOREIGN KEY ("last_printed_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colecta_ruta_progress" ADD CONSTRAINT "colecta_ruta_progress_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colecta_ruta_progress" ADD CONSTRAINT "colecta_ruta_progress_last_closed_lote_id_fkey" FOREIGN KEY ("last_closed_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_cutoff_lote_id_fkey" FOREIGN KEY ("cutoff_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_from_lote_id_fkey" FOREIGN KEY ("from_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_to_lote_id_fkey" FOREIGN KEY ("to_lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job_items" ADD CONSTRAINT "print_job_items_print_job_id_fkey" FOREIGN KEY ("print_job_id") REFERENCES "print_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "print_job_items" ADD CONSTRAINT "print_job_items_linea_id_fkey" FOREIGN KEY ("linea_id") REFERENCES "linea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eventos" ADD CONSTRAINT "eventos_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
