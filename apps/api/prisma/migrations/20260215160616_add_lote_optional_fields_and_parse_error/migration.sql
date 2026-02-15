-- DropForeignKey
ALTER TABLE "lote" DROP CONSTRAINT "lote_productos_version_id_fkey";

-- DropForeignKey
ALTER TABLE "lote" DROP CONSTRAINT "lote_rutas_version_id_fkey";

-- AlterTable
ALTER TABLE "lote" ADD COLUMN     "parse_error" TEXT,
ALTER COLUMN "business_date" DROP NOT NULL,
ALTER COLUMN "productos_version_id" DROP NOT NULL,
ALTER COLUMN "rutas_version_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_productos_version_id_fkey" FOREIGN KEY ("productos_version_id") REFERENCES "productos_master_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_rutas_version_id_fkey" FOREIGN KEY ("rutas_version_id") REFERENCES "rutas_master_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;
