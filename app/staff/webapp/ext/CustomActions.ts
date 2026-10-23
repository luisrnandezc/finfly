import Button from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import VBox from "sap/m/VBox";
import type ExtensionAPI from "sap/fe/templates/ListReport/ExtensionAPI";
import type ODataModel from "sap/ui/model/odata/v4/ODataModel";

type FieldDefinition = {
  label: string;
  parameter: string;
  password?: boolean;
};

type DialogOptions = {
  title: string;
  fields: FieldDefinition[];
  operationPath: string;
  submitText: string;
  successMessage: string;
};

function openActionDialog(api: ExtensionAPI, options: DialogOptions): void {
  const fields = options.fields.map(({ label, parameter, password }) => ({
    label,
    parameter,
    input: new Input({
      required: true,
      type: password ? "Password" : "Text",
      width: "100%"
    })
  }));
  const content = fields.flatMap(({ label, input }) => [
    new Label({ text: label, labelFor: input }),
    input
  ]);
  const submitButton = new Button({ text: options.submitText, type: "Emphasized" });
  const dialog = new Dialog({
    title: options.title,
    contentWidth: "32rem",
    content: new VBox({
      items: content,
      renderType: "Bare"
    }).addStyleClass("sapUiSmallMargin"),
    beginButton: submitButton,
    endButton: new Button({
      text: "Cancel",
      press: () => dialog.close()
    }),
    afterClose: () => dialog.destroy()
  });

  const submit = async (): Promise<void> => {
    for (const { input } of fields) {
      input.setValueState("None");
    }
    const missingField = fields.find(({ input }) => !input.getValue().trim());
    if (missingField) {
      missingField.input.setValueState("Error");
      missingField.input.focus();
      return;
    }

    submitButton.setBusy(true);
    try {
      const model = api.getModel() as ODataModel | undefined;
      if (!model) {
        throw new Error("The Staff service is not available");
      }
      const operation = model.bindContext(options.operationPath);
      for (const { parameter, input } of fields) {
        operation.setParameter(parameter, input.getValue().trim());
      }
      await operation.invoke();
      model.refresh();
      dialog.close();
      MessageToast.show(options.successMessage);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The operation could not be completed";
      MessageBox.error(message);
    } finally {
      submitButton.setBusy(false);
    }
  };
  submitButton.attachPress(() => {
    void submit();
  });

  api.addDependent(dialog);
  dialog.open();
}

export default {
  createOrganization(this: ExtensionAPI): void {
    openActionDialog(this, {
      title: "Create Organization",
      operationPath: "/createOrganization(...)",
      submitText: "Create",
      successMessage: "Organization and administrator created successfully",
      fields: [
        { label: "Organization Code", parameter: "code" },
        { label: "Organization Name", parameter: "name" },
        { label: "Administrator User ID", parameter: "administratorUserId" },
        { label: "Temporary Password", parameter: "temporaryPassword", password: true },
        { label: "Administrator National ID", parameter: "nationalId" },
        { label: "Administrator First Name", parameter: "firstName" },
        { label: "Administrator Last Name", parameter: "lastName" }
      ]
    });
  },

  addAdministrator(this: ExtensionAPI): void {
    const selected = this.getSelectedContexts();
    if (selected.length !== 1) {
      MessageBox.information("Select one organization before adding an administrator");
      return;
    }
    const organization = selected[0];
    if (!organization.getProperty("active")) {
      MessageBox.information("Administrators can only be added to an active organization");
      return;
    }
    if (organization.getProperty("code") === "FINFLY") {
      MessageBox.information("Customer administrators cannot be added to the internal organization");
      return;
    }

    openActionDialog(this, {
      title: "Add Administrator",
      operationPath: `${organization.getPath()}/StaffService.addAdministrator(...)`,
      submitText: "Add",
      successMessage: "Administrator created successfully",
      fields: [
        { label: "User ID", parameter: "userId" },
        { label: "Temporary Password", parameter: "temporaryPassword", password: true },
        { label: "National ID", parameter: "nationalId" },
        { label: "First Name", parameter: "firstName" },
        { label: "Last Name", parameter: "lastName" }
      ]
    });
  }
};
