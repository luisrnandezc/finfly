import Button from "sap/m/Button";
import Dialog from "sap/m/Dialog";
import Input from "sap/m/Input";
import Label from "sap/m/Label";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import VBox from "sap/m/VBox";
import type ExtensionAPI from "sap/fe/templates/ListReport/ExtensionAPI";
import type ODataModel from "sap/ui/model/odata/v4/ODataModel";

type OrganizationInput = {
  label: string;
  parameter: string;
  input: Input;
};

function field(label: string, parameter: string, password = false): OrganizationInput {
  const input = new Input({
    required: true,
    type: password ? "Password" : "Text",
    width: "100%"
  });
  return { label, parameter, input };
}

export default {
  createOrganization(this: ExtensionAPI): void {
    const fields = [
      field("Organization Code", "code"),
      field("Organization Name", "name"),
      field("Administrator User ID", "administratorUserId"),
      field("Temporary Password", "temporaryPassword", true),
      field("Administrator National ID", "nationalId"),
      field("Administrator First Name", "firstName"),
      field("Administrator Last Name", "lastName")
    ];

    const content = fields.flatMap(({ label, input }) => [
      new Label({ text: label, labelFor: input }),
      input
    ]);
    const createButton = new Button({ text: "Create", type: "Emphasized" });
    const dialog = new Dialog({
      title: "Create Organization",
      contentWidth: "32rem",
      content: new VBox({
        items: content,
        renderType: "Bare"
      }).addStyleClass("sapUiSmallMargin"),
      beginButton: createButton,
      endButton: new Button({
        text: "Cancel",
        press: () => dialog.close()
      }),
      afterClose: () => dialog.destroy()
    });

    const submit = async (): Promise<void> => {
      const missingField = fields.find(({ input }) => !input.getValue().trim());
      if (missingField) {
        missingField.input.setValueState("Error");
        missingField.input.focus();
        return;
      }

      createButton.setBusy(true);
      try {
        const model = this.getModel() as ODataModel | undefined;
        if (!model) {
          throw new Error("The Staff service is not available");
        }
        const operation = model.bindContext("/createOrganization(...)");
        for (const { parameter, input } of fields) {
          operation.setParameter(parameter, input.getValue().trim());
        }
        await operation.invoke();
        model.refresh();
        dialog.close();
        MessageToast.show("Organization and administrator created successfully");
      } catch (error) {
        const message = error instanceof Error ? error.message : "The organization could not be created";
        MessageBox.error(message);
      } finally {
        createButton.setBusy(false);
      }
    };
    createButton.attachPress(() => {
      void submit();
    });

    this.addDependent(dialog);
    dialog.open();
  }
};
