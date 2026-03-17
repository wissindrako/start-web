import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';

import { FormFieldsPersonalData } from '@/features/personal-data/schema';

export const FormPersonalData = () => {
  const { t } = useTranslation(['personal-data']);
  const form = useFormContext<FormFieldsPersonalData>();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.nombre.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="nombre"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.primerApellido.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="primerApellido"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.segundoApellido.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="segundoApellido"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.tipoDocumento.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="tipoDocumento"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.numeroDocumento.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="numeroDocumento"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.fechaNacimiento.label')}
          </FormFieldLabel>
          <FormFieldController
            type="date"
            control={form.control}
            name="fechaNacimiento"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.genero.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="genero"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.telefono.label')}
          </FormFieldLabel>
          <FormFieldController
            type="tel"
            control={form.control}
            name="telefono"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.telefonoAlternativo.label')}
          </FormFieldLabel>
          <FormFieldController
            type="tel"
            control={form.control}
            name="telefonoAlternativo"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.pais.label')}
          </FormFieldLabel>
          <FormFieldController type="text" control={form.control} name="pais" />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.departamento.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="departamento"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.ciudad.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="ciudad"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.direccion.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="direccion"
          />
        </FormField>
        <FormField>
          <FormFieldLabel>
            {t('personal-data:common.codigoPostal.label')}
          </FormFieldLabel>
          <FormFieldController
            type="text"
            control={form.control}
            name="codigoPostal"
          />
        </FormField>
      </div>
    </div>
  );
};
